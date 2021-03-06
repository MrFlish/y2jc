import chalk from "chalk";
import { filterLowest, keepHighestPaths, TypeGroups } from "../utils/paths";
import Source from "./IODirectory/source";
import Target from "./IODirectory/target";
import Compilable from "./compilable";
import { Directory, SimpleFile } from "./files";
import { configurationOptions } from "../validation/configuration.interface";

export class Compiler extends Compilable {
    private _source: Source;
    private _target: Target;
    private readonly _options: configurationOptions;

    constructor(source: Source, target: Target, options: configurationOptions){
        super();
        this._source = source;
        this._target = target;
        this._options = options;
    }

    public showoptions(): void{
        console.log(this.options);
    }
    
    public get source(): Source { return this._source; };
    public get target(): Target { return this._target; };
    public get options(): configurationOptions { return this._options; };
    
    /**
     * Vérifie : 
     * 
     * - Que la source existe et qu'elle mène vers un réperoire
     * - Que la cible ne pointe pas vers la racine du module
     * - Que la source et la cible sont différentes
     * @returns 
     */
    public async verify(): Promise<void>{
        try {
            await this.source.checksource();
            await this.target.checktarget();
            let error = new Error();
            error.message = chalk.red(`Source and Target paths share the same root path : '${this.source}'`);
            (error as any).code = "ESAME_ROOT";
            if(this.source.root === this.target.root) return Promise.reject(error);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }
    private async syncMissing(srce: TypeGroups, trgt: TypeGroups): Promise<void>{
        const missing = this.findMissing(srce, trgt);
        missing.directories = filterLowest(missing.directories);            
            try {
                await this.target.createMissingDirectories(missing.directories);
                for(const f of missing.files){
                    const target = this.resolveTargetName(f);
                    if(this.isCompilable(f)) await this.target.yamlToJson(f.absolute, target, this.options.pretty, this.options.indent);
                    else await this.target.copyFile(f.absolute, target);
                }
                return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async syncOrphans(srce: TypeGroups, trgt: TypeGroups): Promise<void>{
        let orphans = this.findOrphans(srce, trgt);
        orphans = keepHighestPaths(orphans);
        try {
            await this.target.removeOrphans(orphans);
            return;
        } catch(e: any) {  return Promise.reject(e); };
    }

    private async syncExisting(srce: TypeGroups, trgt: TypeGroups): Promise<void>{
        const existing = this.findExisting(srce, trgt);        
        try {
            for(const f of existing.files){
                const target = this.resolveTargetName(f);
                const smtime = await this.source.mtimeof(f.absolute);
                const tmtime = await this.target.mtimeof(target);
                if(!(smtime > tmtime)) continue;
                if(this.isCompilable(f)) await this.target.yamlToJson(f.absolute, target, this.options.pretty, this.options.indent);
                else await this.target.copyFile(f.absolute, target);
            }
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async sync(): Promise<void>{
        await this.source.updateTree();
        await this.target.updateTree();
        const srce: TypeGroups = {
            files: this.source.files,
            directories: this.source.directories
        }
        const trgt: TypeGroups = {
            files: this.target.files,
            directories: this.target.directories
        }

        try {
            await this.syncOrphans(srce, trgt);
            await this.syncMissing(srce, trgt);
            await this.syncExisting(srce, trgt);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async init(): Promise<void>{
        try {
            await this.source.init(this.options.watch);
            await this.target.init();
            await this.sync();
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async watch(): Promise<void>{
        try {
            if(!this.options.watch) return;
            this.source.on("acu", async (e, d) => {
                if(e !== "change") await this.sync();
                else await this.handleChangeEvent(d);
            })
            this.source.on("rename", async ([o, n]) => {
                await this.handleRenameEvent(o, n);
            })
            await this.source.watchFiles();
            return;
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
                    if(this.isCompilable(s)) return s.relativeBase
                    else return s.relative
                })
                .includes((this.isCompilable(t) ? t.relativeBase : t.relative))
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
                    if(this.isCompilable(t)) return t.relativeBase
                    else return t.relative
                })
                .includes((this.isCompilable(s) ? s.relativeBase : s.relative))
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
                    if(this.isCompilable(t)) return t.relativeBase
                    else return t.relative
                })
                .includes((this.isCompilable(s) ? s.relativeBase : s.relative))
            )
        })
        const directories = target.directories.filter(d => source.directories.map(({ relative }) => relative).includes(d.relative));
        return { files, directories };
    }

    private async handleChangeEvent(files: TypeGroups): Promise<void>{
        try {
            for(const f of files.files){
                const target = this.resolveTargetName(f);
                const smtime = await this.source.mtimeof(f.absolute);
                const tmtime = await this.target.mtimeof(target);
                if(!(smtime > tmtime)) continue;
                if(this.isCompilable(f)) await this.target.yamlToJson(f.absolute, target, this.options.pretty, this.options.indent);
                else await this.target.copyFile(f.absolute, target);
            }
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleRenameEvent(oldfiles: TypeGroups, newfiles: TypeGroups): Promise<void>{
        try {
            for(let i = 0; i < oldfiles.directories.length; ++i){
                const todir = oldfiles.directories[i].absoluteFrom(this.target.root);
                const tndir = newfiles.directories[i].absoluteFrom(this.target.root);
                await this.target.rename(todir, tndir);
            }
            
            for(let i = 0; i < oldfiles.files.length; ++i){
                const ofile = oldfiles.files[i];
                const nfile = newfiles.files[i];
                const tofile = this.resolveTargetName(ofile);
                const tnfile = this.resolveTargetName(nfile);
                await this.target.rename(tofile, tnfile);
            }
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private resolveTargetName(source: SimpleFile | Directory): string {
        let target: string;
        if(source instanceof Directory){
            target = source.absoluteFrom(this.target.root);
        }
        else {
            target = this.isCompilable(source) ?
            source.absoluteBaseFrom(this.target.root) + ".json" : source.absoluteFrom(this.target.root);
        }
        return target;
    }
}