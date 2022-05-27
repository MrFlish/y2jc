import Finder from "./finder";
import fsp from "fs/promises";
import chalk from "chalk";
import { BaseSchema } from "yup";
import path from "path";
import YAML from "yaml";

type FileData = { input: string, output: string };

export interface ModuleConfigurationData {
    inputs: string[];
    outputs: string[];
    pretty?: boolean;
    indent?: number;
    files?: FileData[];
    blacklist?: string[];
}

/**
 * Finds the module configuration file and validates it.
 * @param from From where to start looking for the file.
 * @param count This function will jump on the next direct parent directory if it does not find the specified path.
 * How far is it able to go ? Specify a number of jumps before the file is conseidered missing.
 * @param yaml_filename Name of the module configuration file.
 * @param validationSchema schema to use to validate data.
 * @returns the objectified configuration.
*/
export const getModuleConfiguration = function(from: string, count: number, yaml_filename: string, validationSchema: BaseSchema): Promise<ModuleConfigurationData>{
    return new Promise(async (resolve, reject) => {
        try{
            // //Get the location of the node_modules folder.
            // const finder = new Finder();
            // const nm_p = await finder.findNodeModules(from, count);

            // //Check if the module configuration exists.
            // const dir = await fsp.readdir(nm_p);
            // let error = `Could not find configuration file '${yaml_filename}' in the project.\nMake sure it is located at the same level as the node_modules folder.`;
            // if(!(dir).includes(yaml_filename)) throw new Error(chalk.red(error));

            // //Parsing yaml data into js object.
            // const ofile = await getObject(yaml_filename);

            // //validate configuration data.
            // await validationSchema.validate(ofile)
            // return resolve(ofile as ModuleConfigurationData);
        }
        catch(e){ reject(e) };
    });
}

export class ModuleConfiguration {
    protected filename: string;
    public data: ModuleConfigurationData | null;
    protected schema: BaseSchema;
    private found: boolean;
    private rootFound: boolean;
    private _app_root: string;
    public filepath: string;

    constructor(filename: string, schema: BaseSchema){
        this.filename = filename;
        this.data = null;
        this.schema = schema;
        this.found = false;
        this._app_root = "";
        this.filepath = "";
        this.rootFound = false;
    }

    get app_root(): string {
        const error = new Error(chalk.red("Could not return app_root. Find configuration file first."));        
        if(this.rootFound) return this._app_root;
        else throw error;
    }
    
    private findRoot(from: string, count: number): Promise<string>{
        return new Promise(async (resolve, reject) => {
            try{
                const finder = new Finder();
                this._app_root = await finder.findNodeModules(from, count);
                this.rootFound = true;
                return resolve(this._app_root)
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
                const dir = await fsp.readdir(this.app_root);
                let error = `File '${this.filename}' could not be found at path '${this.app_root}'`;
                if(!dir.includes(this.filename)) return reject(new Error(chalk.red(error)));
                this.filepath = path.resolve(this.app_root, this.filename); 
                await this.verify();
                this.found = true;
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

    public load(): Promise<ModuleConfigurationData>{
        return new Promise(async (resolve, reject) => {
            try{
                // if(!this.found) await this.find(__dirname, 5);
                let error = `Could not load file '${this.filename}' because it hasn't been found / verified yet.`;
                if(!this.found) return reject(new Error(chalk.red(error)));
                const yfile = await fsp.readFile(this.filepath, { encoding: "utf-8" });
                const ofile = YAML.parse(yfile);
                await this.schema.validate(ofile);
                this.data = ofile;
                return resolve(ofile);
            }catch(e){ reject(e); }
        });
    }
}