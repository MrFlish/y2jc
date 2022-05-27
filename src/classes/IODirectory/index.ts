import fse from "fs-extra";
import path from "path";
import { Directory, SimpleFile } from "../files";
import { TypeSimpleGroups } from "./types";
import { recursiveList, TRecursiveOptions, TypeGroups } from "../../utils/paths"

/**
 * An abstract class representing a directory path.
 */
abstract class IODirectory {
    private readonly _root: string;
    private _all: string[];
    private _files: SimpleFile[];
    private _directories: Directory[];

    constructor(root: string){
        this._root = path.join(root);
        this._all = [];
        this._files = [];
        this._directories = [];
    }

    public get root(): string { return this._root };
    public get all(): string[] { return this._all };
    public get files(): SimpleFile[] { return this._files };
    public get directories(): Directory[] { return this._directories };
    

    protected set all(all: string[]) { this._all = all; };
    protected set files(files: SimpleFile[]) { this._files = files; };
    protected set directories(files: Directory[]) { this._directories = files; };

    /**
     * Scans recursively all the filepaths in the given root path.
     * Populates `all` property.
     * @param options 
     * @returns 
     */
    protected async scanTree(options: TRecursiveOptions = {}): Promise<string[]>{
        try {
            this.all = await recursiveList(this.root, options)
            return this.all;
        } catch(e: any) { return Promise.reject(e); }
    }

    protected memSegregateTree(filepaths: string[], asobj?: false): TypeSimpleGroups;
    protected memSegregateTree(filepaths: string[], asobj?: true): TypeGroups;
    protected memSegregateTree(filepaths: string[], asobj?: boolean): TypeSimpleGroups | TypeGroups{
        const files: string[] = filepaths.filter(f => this.files.map(({absolute}) => absolute).includes(f));
        const directories: string[] = filepaths.filter(d => this.directories.map(({absolute}) => absolute).includes(d));
        if(asobj) return {
            files: files.map(f => new SimpleFile(f, this.root)),
            directories: directories.map(d => new Directory(d, this.root))
        }
        else return { files, directories };  
    }

    /**
     * A list of paths given, separates them into an object.
     * @param filepaths List of paths to separate.
     * @param asobj If `true` returns the files/directories into `SimpleFile` and `Directory` arrays.
     * `false` by default.
     */
    protected async segregateTree(filepaths: string[], asobj?: false): Promise<TypeSimpleGroups>;
    protected async segregateTree(filepaths: string[], asobj?: true): Promise<TypeGroups>;
    protected async segregateTree(filepaths: string[], asobj?: boolean): Promise<TypeGroups | TypeSimpleGroups>{
        try {
            const files: string[] = [];
            const directories: string[] = [];
            for(const f of filepaths){
                if((await fse.stat(f)).isDirectory()) directories.push(f);
                else files.push(f);
            }
            if(asobj) return {
                files: files.map(f => new SimpleFile(f, this.root)),
                directories: directories.map(d => new Directory(d, this.root))
            }
            else return { files, directories };
        } catch(e: any) { return Promise.reject(e); }
    }

    /**
     * Scans all the files present in the given root path and separates them into their corresponding type.
     * Populates `all`, `files` and `directories` properties.
     * @returns 
     */
    public async updateTree(): Promise<void>{
        try {
            const filepaths: string[] = await this.scanTree();
            const groups = await this.segregateTree(filepaths, true);
            this.files = groups.files;
            this.directories = groups.directories;
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async mtimeof(absolutepath: string): Promise<number>;
    public async mtimeof(absolutepath: SimpleFile): Promise<number>;
    public async mtimeof(absolutepath: SimpleFile | string): Promise<number>{
        try {
            const p: string = (absolutepath instanceof SimpleFile) ? absolutepath.absolute : absolutepath;
            const mtime = (await fse.stat(p)).mtime.valueOf();
            return mtime;
        } catch(e: any) { return Promise.reject(e); }
    }
}

export default IODirectory;