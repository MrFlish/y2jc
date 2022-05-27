import Finder from "./finder";
import fsp from "fs/promises";
import chalk from "chalk";
import { BaseSchema } from "yup";
import path from "path";
import YAML from "yaml";
import { configurationFiles, configurationInterface, configurationOptions } from "../validation/configuration.interface";

export class ModuleConfiguration {
    private readonly _filename: string;
    private readonly _schema: BaseSchema;
    private _root: string;
    private _configurationFound: boolean;
    private _filepath: string;
    private _files: configurationFiles[];
    private _options: configurationOptions;

    constructor(filename: string, schema: BaseSchema){
        this._filename = filename;
        this._schema = schema;
        this._configurationFound = false;
        this._root = "";
        this._filepath = "";
        this._files = [];
        this._options = { watch: false, pretty: false, indent: 2 };
    }

    public  get root(): string { return this._root; };
    public  get filepath(): string { return this._filepath; };
    private get filename(): string { return this._filename; };
    private get schema(): BaseSchema { return this._schema; };
    private get configurationFound(): boolean { return this._configurationFound; };
    public  get options(): configurationOptions { return this._options; };
    public  get files():  configurationFiles[] { return this._files; };
    
    
    private set options(options: configurationOptions) { this._options = options; };
    private set files(files: configurationFiles[]) { this._files = files; };
    
    private set root(root: string) { this._root = root; };
    private set configurationFound(configurationFound: boolean) { this._configurationFound = configurationFound; };
    private set filepath(filepath: string) { this._filepath = filepath; };
    

    private findRoot(from: string, count: number): Promise<string>{
        return new Promise(async (resolve, reject) => {
            try{
                const finder = new Finder();
                this.root = await finder.findNodeModules(from, count);
                return resolve(this.root)
            }
            catch(e: any){ return reject(e); }
        });
    }

    /**
     * Finds module configuration file.
     * This file has to be at the same level as the node_modules folder.
     * @param from Where to start searching
     * @param count If does not find the file, goes back up the fs tree. How far is it able to go ?
     * @returns The path where the module configuration file is located.
     */
    public find(from: string, count: number): Promise<string>{
        return new Promise(async (resolve, reject) => {
            try{
                await this.findRoot(from, count);
                const dir = await fsp.readdir(this.root);
                let error = `File '${this.filename}' could not be found at path '${this.root}'`;
                if(!dir.includes(this.filename)) return reject(new Error(chalk.red(error)));
                this.filepath = path.resolve(this.root, this.filename); 

                await this.verify();
                this.configurationFound = true;
                return resolve(this.filepath);
            }catch(e){ reject(e); }         
        });
    }

    private verify(): Promise<void>{
        return new Promise(async (resolve, reject) => {
            try{
                const stats = await fsp.stat(this.filepath);
                let error = `File at '${this.filepath}' is a directory. A yaml file was expected.`;
                if(stats.isDirectory()) return reject(new Error(chalk.red(error)));
                return resolve();
            }
            catch(e: any){ return reject(e); }
        });
    }

    public load(): Promise<configurationInterface>{
        return new Promise(async (resolve, reject) => {
            try{
                const defaultOption = { pretty: false, watch: false, indent: 2 };
                let error = `Could not load file '${this.filename}' because it hasn't been found yet.`;
                if(!this.configurationFound) return reject(new Error(chalk.red(error)));
                const yfile = await fsp.readFile(this.filepath, { encoding: "utf-8" });
                const ofile = YAML.parse(yfile);
                
                let data: configurationInterface = await this.schema.validate(ofile);
                data = Object.assign(defaultOption, data)
                const { watch, pretty, indent, files } = data;
                this.options = { watch, pretty, indent };
                this.files = this.resolveFilepaths(files);
                return resolve(data);
            }catch(e){ reject(e); }
        });
    }

    private resolveFilepaths(files: configurationFiles[]): configurationFiles[]{
        return files.map(f => ({
            source: path.resolve(this.root, f.source),
            target: path.resolve(this.root, f.target)
        }));
    }
}