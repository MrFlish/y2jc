import chalk from "chalk";
import path from "path";
import fse from "fs-extra";
import { APPROOT } from "../ROOT";
import { Directory, SimpleFile } from "./files";
import { filterHighest, filterLowest } from "../utils/paths";
import YAML from "yaml";
import chokidar from "chokidar";
import { debounce } from "throttle-debounce";

export type TIsDirectory = { filepath: string, isDirectory: boolean };
export type TRecursiveOptions = { filter?: string[], files?: string[] };
export type TSyncOptions = { filterExtensions?: string[] };
type TypeGroups = { files: SimpleFile[], directories: Directory[] };
type TFileEvent = { e: string, p: string };
type TSortedEventStack = { added: string[], unlinked: string[], changed: string[] }

const COMPILABLE_EXTENSIONS = [".yaml", ".json"];

export class Compiler {
    public source: string;
    public target: string;
    private compilableExtensions: Set<string>;
    private _watcher: chokidar.FSWatcher;
    private fileEventStack: TFileEvent[]; 
    private debouncer: () => void | Promise<void>;

    constructor(source: string, target: string, debounceTime: number = 250){
        this.source = source;
        this.target = target;
        this.compilableExtensions = new Set(COMPILABLE_EXTENSIONS.map(e => this.resolveExtension(e)));
        this._watcher = new chokidar.FSWatcher({ ignoreInitial: true });
        this.fileEventStack = [];
        this.debouncer = debounce(debounceTime, this.filterStack)
    }

    private separateFileEventStack(stack: TFileEvent[]): TSortedEventStack{
        const sort = (arr: string[]) => arr.sort((a, b) => a.localeCompare(b));
        const added = sort(stack.filter(({ e }) => ["add", "addDir"].includes(e)).map(({ p }) => p));
        const unlinked = sort(stack.filter(({ e }) => ["unlink", "unlinkDir"].includes(e)).map(({ p }) => p));
        const changed = sort(stack.filter(({ e }) => ["change"].includes(e)).map(({ p }) => p));
        return { added, unlinked, changed };
    }
    
    private checkUnlinkedAddedLengths(unlinked: string[], added: string[]): boolean{
        return unlinked.length === added.length;
    }

    private findDifferenceIndexes(unlinked: string, added: string): number[]{
        const u = [...unlinked.split("/")];
        const a = [...added.split("/")];
        const differences: number[] = a.filter((v, i) => a[i] !== u[i]).map((v, i) => i);
        return differences;
    }

    private findAllDifferenceIndexes(unlinked: string[], added: string[]): number[][]{
        const differences: number[][] = unlinked.map((v, i) => this.findDifferenceIndexes(unlinked[i], added[i]));
        return differences;
    }

    private checkAllIndexesLengths(indexes: number[][]): boolean{
        return !indexes.some(i => i.length !== 1);
    }

    private checkAllIndexesPositions(indexes: number[][]): boolean{
        const flatten: number[] = indexes.map(i => i[0]);
        return !flatten.some(i => i !== flatten[0]);
    }

    private checkSegmentsPairLength(unlinked: string, added: string): boolean{
        const u = [...unlinked.split("/")];
        const a = [...added.split("/")];
        if(u.length !== a.length) return false;
        if(u.length <= 1) return false;
        return true;
    }
    private checkAllPathsSegmentsLengths(unlinked: string[], added: string[]): boolean{
        const lengthsOK: boolean[] = unlinked.map((v, i) => this.checkSegmentsPairLength(unlinked[i], added[i]));
        return !lengthsOK.some(l => !l);
    }

    private checkAllDifferencesValue(unlinked: string[], added: string[], indexes: number[][]): boolean{
        const flatten = indexes.map(i => i[0]);
        const unlinkedSegment: string = unlinked[0].split("/")[flatten[0]];
        const addedSegment: string = added[0].split("/")[flatten[0]];

        const uvalues: string[] = unlinked.map((u, i) => unlinked[i].split("/")[flatten[i]]);
        const avalues: string[] = added.map((u, i) => added[i].split("/")[flatten[i]]);

        const uok: boolean = !uvalues.some(u => u !== unlinkedSegment);
        const aok: boolean = !avalues.some(a => a !== addedSegment);

        return uok && aok;
    }

    private renameTargetDirectory(oldpath: Directory, newpath: Directory): Promise<void>{
        return fse.rename(oldpath.absoluteFrom(this.target), newpath.absoluteFrom(this.target))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private async handleRename(unlinked: string[], added: string[]): Promise<void>{
        try {
                
            if(!this.checkUnlinkedAddedLengths(unlinked, added)){
                console.log("'add' event and 'unlink' event stacks do not contain the same amount of altered paths.")
                return;
            }
            if(!this.checkAllPathsSegmentsLengths(unlinked, added)){
                console.log("One or more pair of paths are not synced. Could not process further.");
                return;
            }
            const indexes: number[][] = this.findAllDifferenceIndexes(unlinked, added);
            if(!this.checkAllIndexesLengths(indexes)){
                console.log("One or more path do not contain ONE change on it.");
                return;
            }
            if(!this.checkAllIndexesPositions(indexes)){
                console.log("One or more paths have their change on a different position.");
                return;
            }
            if(!this.checkAllDifferencesValue(unlinked, added, indexes)){
                console.log("All the paths do not contain the same modification.");
                return;
            }
            const highestUnlinkedPath: Directory[] = filterHighest(unlinked.map(u => new Directory(u, this.source)));
            const highestAddedPath: Directory[] = filterHighest(added.map(a => new Directory(a, this.source)));
            if(highestAddedPath.length !== 1 || highestUnlinkedPath.length !== 1){
                console.log("Found more than one path change.");
                return;
            }            
            await this.renameTargetDirectory(highestUnlinkedPath[0], highestAddedPath[0]);


            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleAdd(added: string[]): Promise<void>{
        try {
            const groups = await this.separateFilesFromDirectories(added, this.source);
            await this.createMissingFiles(groups.files)
            await this.createMissingDirectories(groups.directories);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleUnlinked(unlinked: string[]): Promise<void>{
        try {
            await this.syncOrphans();
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleChanged(changed: string[]): Promise<void>{
        try {
            const groups = await this.separateFilesFromDirectories(changed, this.source);
            await this.overwriteExistingFiles(groups.files);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async filterStack(): Promise<void>{
        this.syncExisting
        this.syncMissing
        this.syncOrphans
        console.log(this.fileEventStack.map(f => `event ${f.e} on ${f.p}`));
        try {
            const groups: TSortedEventStack = this.separateFileEventStack(this.fileEventStack)
            if(groups.changed.length > 0){
                await this.handleChanged(groups.changed);
                console.log("Change event triggered");
            }

            else if(groups.unlinked.length > 0 && groups.added.length === 0){
                await this.handleUnlinked(groups.unlinked);
                console.log("unlink event triggered");
            } 
            else if(groups.unlinked.length === 0 && groups.added.length > 0){
                console.log("Add event triggered");
                await this.handleAdd(groups.added);
            }
            else if(groups.unlinked.length > 0 && groups.added.length > 0){
                console.log("Rename event triggered");
                
                await this.handleRename(groups.unlinked, groups.added);
            }
            else {
                let error = new Error(`groups.unlinked.length = ${groups.unlinked.length} | groups.added.length = ${groups.added.length}.`)
                Promise.reject(error);
            }

            this.fileEventStack = [];
            return;
        
        } catch(e: any) { return Promise.reject(e); }        
    }

    get watcher(): chokidar.FSWatcher { return this._watcher };

    public addCompilableExtension(extension: string): this{
        this.compilableExtensions.add(this.resolveExtension(extension));
        return this;
    }

    public deleteCompilableExtension(extension: string): this{
        this.compilableExtensions.delete(this.resolveExtension(extension));
        return this;
    }

    private resolveExtension(extension: string): string{
        if(extension.indexOf('.') === 0) return extension
        else return `.${extension}`;
    }

    /**
     * Verifies and synchronizes all the files in both source and destination directories.
     */
    public async init(): Promise<void>{
        try {
            await this.verifyPaths();
            await this.synchronize();
            this._watcher.add(this.source);
            this._watcher.on("ready", () => Promise.resolve());
        } catch(e: any) { Promise.reject(e); }
    }

    private async separateFilesFromDirectories(filepaths: string[], from: string): Promise<TypeGroups>{
        const files: SimpleFile[] = [];
        const directories: Directory[] = [];
        try {
            for(const f of filepaths){
                if((await fse.stat(f)).isDirectory()) directories.push(new Directory(f, from));
                else files.push(new SimpleFile(f, from));
            }
            return { files, directories };
        } catch(e: any) { return Promise.reject(e); }
    }

    /**
     * Given a source and a target directory,
     * finds the orphan files (files that exist in the target, but do not exist in the source).
     * @param source Source directory
     * @param target Target directory
     * @returns All the filepaths that exist in the target, but not in the source
     */
    private findOrphans(source: TypeGroups, target: TypeGroups): TypeGroups{
        const files = target.files.filter(t => {
            return !(
                source.files.map(s => {
                    if(this.compilableExtensions.has(path.extname(s.relative))) return s.relativeBase
                    else return s.relative
                })
                .includes((this.compilableExtensions.has(path.extname(t.relative)) ? t.relativeBase : t.relative))
            )
        })
        const directories = target.directories.filter(d => {
            return !source.directories.map(({ relative }) => relative).includes(d.relative)
        });
        return { files, directories };
    }

    /**
     * Given a source and a target directory,
     * finds the missing files (files that do not exist in the target, but does exist in the source).
     * @param source Source directory
     * @param target Target directory
     * @returns All the filepaths that exist in the source but not in the target.
     */
    private findMissing(source: TypeGroups, target: TypeGroups): TypeGroups{
        const files = source.files.filter(s => {
            return !(
                target.files.map(t => {
                    if(this.compilableExtensions.has(path.extname(t.relative))) return t.relativeBase
                    else return t.relative
                })
                .includes((this.compilableExtensions.has(path.extname(s.relative)) ? s.relativeBase : s.relative))
            )
        })
        const directories = source.directories.filter(s => {
            return !target.directories.map(({ relative }) => relative).includes(s.relative)
        });
        return { files, directories };
    }

    /**
     * Given a source and a target directory,
     * finds the existing files (files that exist in both the source and the target directory).
     * @param source Source directory
     * @param target Target directory
     * @returns All the filepaths that exist in both the source and the target directory.
     */
    private findExisting(source: TypeGroups, target: TypeGroups): TypeGroups{
        const files = source.files.filter(s => {
            return (
                target.files.map(t => {
                    if(this.compilableExtensions.has(path.extname(t.relative))) return t.relativeBase
                    else return t.relative
                })
                .includes((this.compilableExtensions.has(path.extname(s.relative)) ? s.relativeBase : s.relative))
            )
        })
        const directories = target.directories.filter(d => source.directories.map(({ relative }) => relative).includes(d.relative));
        return { files, directories };
    }

    private async overwriteExistingFiles(files: SimpleFile[]): Promise<void>{
        const results = await Promise.all(files.map(f => this.sourceHasChanged(f)));
        for(let i = 0; i < files.length; ++i){
            if(results[i]) await this.createFileFromSource(files[i]);
        }
        return;
    }

    private async sourceHasChanged(source: SimpleFile): Promise<boolean>{
        try {
            const srce = source.absolute;
            const trgt = this.targetPathFromSource(source);
            const smtime = (await fse.stat(srce)).mtime;
            const tmtime = (await fse.stat(trgt)).mtime;
            return (smtime.valueOf() > tmtime.valueOf());
        } catch(e: any) { return Promise.reject(e); }
    }

    private targetPathFromSource(source: SimpleFile): string{
        if(this.compilableExtensions.has(path.extname(source.relative)))
        return source.absoluteBaseFrom(this.target) + ".json";        
        else return source.absoluteFrom(this.target);
    }

    private async getSourceFiles(): Promise<TypeGroups>{
        try {
            const srceList = await this.recursiveList(this.source);
            return await this.separateFilesFromDirectories(srceList, this.source);
            
        } catch(e: any) { return Promise.reject(e); }    
    }

    private async getTargetFiles(): Promise<TypeGroups>{
        try {
            const trgtList = await this.recursiveList(this.target);
            return await this.separateFilesFromDirectories(trgtList, this.target);
            
        } catch(e: any) { return Promise.reject(e); }    
    }



    /**
     * Compares source and target directory
     * Finds orphan files in the target and removes them
     * Finds missing files from the source and adds it into the target
     * All the existing files will be checked. If the file in the source is newer than the one in target,
     * it will overwrite it.
     * @returns
     */
    private async synchronize(): Promise<void>{
        try {
            //filetype segregation (directories - simple files)
            const srce = await this.getSourceFiles();
            const trgt = await this.getTargetFiles();
    
            //Finding orphans, missing, existing files / directories
            const orphans = this.findOrphans(srce, trgt);
            const missing = this.findMissing(srce, trgt);
            const existing = this.findExisting(srce, trgt); 
    
            //Filtering orphan and missing directories to only keep the relevant ones
            orphans.directories = filterHighest(orphans.directories); 
            missing.directories = filterLowest(missing.directories);

            for(let i = 0; i < orphans.files.length; ++i){
                for(let j = 0; j < orphans.directories.length; ++j){
                    if(orphans.files[i].relative.indexOf(orphans.directories[j].relative) === 0){
                        orphans.files.splice(i, 1);
                        break;
                    }
                }
            }

            if(orphans.directories.length > 0) await this.removeOrphanDirectories(orphans.directories);
            if(orphans.files.length > 0) await this.removeOrphanFiles(orphans.files);
            if(missing.directories.length > 0) await this.createMissingDirectories(missing.directories);
            if(missing.files.length > 0) await this.createMissingFiles(missing.files);
            if(existing.files.length > 0) await this.overwriteExistingFiles(existing.files);

            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async syncMissing(): Promise<void>{
        try {
            //filetype segregation (directories - simple files)
            const srce = await this.getSourceFiles();
            const trgt = await this.getTargetFiles();
            //Finding orphans, missing, existing files / directories
            const missing = this.findMissing(srce, trgt);
            //Filtering orphan and missing directories to only keep the relevant ones
            missing.directories = filterLowest(missing.directories);
            if(missing.directories.length > 0) await this.createMissingDirectories(missing.directories);
            if(missing.files.length > 0) await this.createMissingFiles(missing.files);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async syncOrphans(): Promise<void>{
        try {
            //filetype segregation (directories - simple files)
            const srce = await this.getSourceFiles();
            const trgt = await this.getTargetFiles();
    
            //Finding orphans, missing, existing files / directories
            const orphans = this.findOrphans(srce, trgt);
            //Filtering orphan and missing directories to only keep the relevant ones
            orphans.directories = filterHighest(orphans.directories); 

            for(let i = 0; i < orphans.files.length; ++i){
                for(let j = 0; j < orphans.directories.length; ++j){
                    if(orphans.files[i].relative.indexOf(orphans.directories[j].relative) === 0){
                        orphans.files.splice(i, 1);
                        break;
                    }
                }
            }
            if(orphans.directories.length > 0) await this.removeOrphanDirectories(orphans.directories);
            if(orphans.files.length > 0) await this.removeOrphanFiles(orphans.files);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async syncExisting(): Promise<void>{
        try {
            //filetype segregation (directories - simple files)
            const srce = await this.getSourceFiles();
            const trgt = await this.getTargetFiles();
            //Finding orphans, missing, existing files / directories
            const existing = this.findExisting(srce, trgt); 
            //Filtering orphan and missing directories to only keep the relevant ones
            if(existing.files.length > 0) await this.overwriteExistingFiles(existing.files);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private removeTargetFile(file: SimpleFile): Promise<void>{
        return fse.rm(file.absolute, { recursive: false })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private removeOrphanFiles(files: SimpleFile[]): Promise<void>{
        return Promise.all(files.map(f => this.removeTargetFile(f)))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private removeTargetDirectory(directory: Directory): Promise<void>{
        return fse.rm(directory.absolute, { recursive: true })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private removeOrphanDirectories(directories: Directory[]): Promise<void>{
        return Promise.all(directories.map(d => this.removeTargetDirectory(d)))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private createDirectoryFromSource(source: Directory): Promise<void>{
        return fse.mkdir(source.absoluteFrom(this.target), { recursive: true })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private createMissingDirectories(directories: Directory[]): Promise<void>{
        return Promise.all(directories.map(d => this.createDirectoryFromSource(d)))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private async createFileFromSource(source: SimpleFile): Promise<void>{
        try {
            const isCompilable = this.compilableExtensions.has(path.extname(source.relative));
            let target: string = isCompilable ? 
            source.absoluteBaseFrom(this.target) + ".json" : source.absoluteFrom(this.target);

            if(isCompilable){
                const data = await this.YAMLFromSource(source.absolute);
                await this.JSONToTarget(target, data);
            }
            else {
                console.log(`this path ${source.absolute} : ${target}`);
                await fse.copy(source.absolute, target, { overwrite: true });
            }
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private YAMLFromSource(source: string): Promise<object>{
        return fse.readFile(source, { encoding: "utf-8" })
        .then(s => Promise.resolve(YAML.parse(s)))
        .catch(e => Promise.reject(e));
    }

    private JSONToTarget(target: string, data: object): Promise<void>{
        const json = JSON.stringify(data);
        return fse.writeFile(target, json, { encoding: "utf-8" })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    private createMissingFiles(files: SimpleFile[]): Promise<void>{
        return Promise.all(files.map(f => this.createFileFromSource(f)))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    /**
     * Lists recursively all paths in the given directory
     * @param start Directory where to start searching for all paths
     * @param options 
     * @returns 
     */
    private async recursiveList(start: string, options: TRecursiveOptions = {}): Promise<string[]>{        
        try {
            let files  = options.files  || [];
            const filter = (options.filter || []).map(f => f.indexOf('.') === 0 ? f : '.' + f);
            const currdir = await fse.readdir(start);
            for(const f of currdir){
                const filepath = path.join(start, f);
                if(!(await this.isDirectory(filepath))){
                    if(filter.length <= 0) files.push(filepath);
                    else { if(filter.includes(path.extname(filepath))) files.push(filepath); }
                }
                else {
                    files = await this.recursiveList(filepath, { files, filter });
                    files.push(filepath);
                }
            }
            return files;
        } catch(e: any) { throw e; }
    }


    public async watch(): Promise<void>{
        this._watcher.on("all", async (e, p, s) => {
            this.fileEventStack.push({ e, p });
            await this.debouncer();
            // await this.synchronize();
            return;
        })
    }

    /**Fait plusieurs vérifications :
     * - La source existe-t-elle ? 
     * - La source est-elle un répertoire ? 
     * - La destination mène-t-elle vers la racine du module ?
     * - La source et la destination sont-elles les mêmes ?
     */
    private async verifyPaths(): Promise<void>{
        let error = new Error();
        try {
            const srceExists = await fse.pathExists(this.source)
            const srceIsDir = await this.isDirectory(this.source);

            error.message = chalk.red(`Given source path '${this.source}' does not exist.`);
            if(!srceExists) return Promise.reject(error);

            error.message = chalk.red(`Given source path '${this.source}' is not a directory.`)
            if(!srceIsDir) return Promise.reject(error);

            error.message = chalk.red(`Destination forbidden. Given destination '${this.target}' leads to the same path as the module sources.`);
            if(this.target === APPROOT) return Promise.reject(error);

            error.message = chalk.red(`Destination forbidden. Given destination '${this.target}' leads to the same path as the source .`);
            if(this.target === this.source) return Promise.reject(error);
            
            return Promise.resolve();

        } catch(e: any) { return Promise.reject(e); }
    }

    /**Retourne la partie variable de la racine renseignée */
    public static relativeTo(filepath: string, to: string): string{
        return filepath.substring(to.length);
    }

    /**
     * Vérifie si le chemin renseigné mène à un répertoire ou non.
     * @param directory 
     * @param asObj 
     */
    private async isDirectory(directory: string, asObj?: false): Promise<boolean>;
    private async isDirectory(directory: string, asObj: true): Promise<TIsDirectory>;
    private async isDirectory(directory: string, asObj?: boolean): Promise<TIsDirectory | boolean>{
        try {
            const isDirectory = (await fse.stat(directory)).isDirectory()
            if(asObj) return Promise.resolve({ filepath: directory, isDirectory });
            else return Promise.resolve(isDirectory);
        } catch(e: any) { return Promise.reject(e); }
    }
}