import path from "path";
import fsp from "fs/promises";
import chalk from "chalk";

class Finder {
    findFile (filename: string, from: string, count: number, appendFilename: boolean = false): Promise<string>{
        return new Promise(async (resolve, reject) => {
            const root = path.parse(from).root;
            try{                                
                const dir = await fsp.readdir(from);
                let p: string;
                if(dir.includes(filename)) p = appendFilename ? path.resolve(from, filename) : path.resolve(from);
                else {
                    const error: any = new Error(chalk.red(`Could not find file ${filename}.`));
                    error.code = "FILE_NOT_FOUND";
                    if(count <= 1 || from === root) return reject(error);
                    else p = await this.findFile(filename, path.resolve(from, "../"), --count, appendFilename);
                }
                return resolve(p);
            }
            catch(e: any){ return reject(e); }
        });
    }
    findNodeModules (from: string, count: number, appendFilename: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            this.findFile("node_modules", from, count, appendFilename)
            .then(d => resolve(d))
            .catch(e => {
                const error = "Could not find the node_modules folder in the project.\nThe configuration file has to be at the same level as the node_modules folder."
                if(e.code === "FILE_NOT_FOUND") return reject(new Error(chalk.red(error)));
                return reject(e);
            })
        });
    }
}

export default Finder;