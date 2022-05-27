import chalk from "chalk";
import { APPROOT } from "../../ROOT";
import { TypeGroups } from "../../utils/paths";
import { Directory, SimpleFile } from "../files";
import IODirectory from "./";
import fse from "fs-extra";
import YAML from "yaml";

/**
 * Represents a target directory.
 * Given a root path, it can find all the filepaths in it.
 * Can write, delete, rename and overwrite files and directories in it.
 */
export class Target extends IODirectory {

    /**
     * @param output Root path of the target directory.
     */
    constructor(output: string){
        super(output);
    }

    /**
     * Verifies :
     * 1 - If the given path is the same as the application root.
     * @returns 
     */
    public async checktarget(): Promise<void>{
        try {
            let error = new Error();
            error.message = chalk.red(`Given target path '${this.root}' is the same as the module root. Operatino forbidden.`);
            (error as any).code = "ESAME_AS_ROOT";
            if(this.root === APPROOT) return Promise.reject(error);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async init(): Promise<void>{
        try {
            await this.checktarget();
            await this.updateTree();
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async removeOrphans(orphans: TypeGroups): Promise<void>{
        try {
            const { files, directories } = orphans;
            await Promise.all(directories.map(d => this.removeDirectory(d)));
            await Promise.all(files.map(f => this.removeFile(f)));
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public removeFile(file: SimpleFile | string): Promise<void>{
        const p: string = (file instanceof SimpleFile) ? file.absolute : file;
        return fse.rm(p)
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    public removeDirectory(directory: Directory | string): Promise<void>{
        const p: string = (directory instanceof Directory) ? directory.absolute : directory;
        return fse.rm(p, { recursive: true })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    public createMissingDirectories(directories: Directory[]): Promise<void>{
        return Promise.all(directories.map(d => this.createDirectory(d)))
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }


    public createDirectory(directory: Directory | string): Promise<void>{
        const p: string = (directory instanceof Directory) ? directory.absolute : directory;
        return fse.mkdir(p, { recursive: true })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    public copyFile(source: string, target: string): Promise<void>{
        return fse.copy(source, target, { overwrite: true, recursive: true })
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }

    public rename<T extends (string | SimpleFile | Directory)>(oldfile: T, newfile: T): Promise<void>{
        const poldfile: string = (oldfile instanceof SimpleFile || oldfile instanceof Directory) ? 
        oldfile.absolute : oldfile;
        const pnewfile: string = (newfile instanceof SimpleFile || newfile instanceof Directory) ?
        newfile.absolute : newfile;
        return fse.rename(poldfile, pnewfile)
        .then(() => Promise.resolve())
        .catch(e => Promise.reject(e));
    }
    public async yamlToJson(source: string, target: string): Promise<void>{
        try {
            const yfile = await fse.readFile(source, { encoding: "utf-8" });
            const ofile = YAML.parse(yfile);
            const jfile = JSON.stringify(ofile);
            await fse.writeFile(target, jfile, { encoding: "utf-8" });
            return;
        } catch(e: any) { return Promise.reject(e); }
    }
}

export default Target;