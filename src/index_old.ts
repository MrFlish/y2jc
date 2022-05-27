import chokidar from "chokidar";
import path from "path";
import fse from "fs-extra";
import YAML from "yaml";
import replaceExt from "replace-ext";
import chalk from "chalk";
import { Compiler } from "./classes/compiler_save";


/**
 * Initialise un watcher chokidar
 * @param srce source du répertoire à surveiller
 * @param waitReady 
 * @returns 
 */
export const initWatcher = async function(srce: string, waitReady: boolean): Promise<chokidar.FSWatcher>{
    const w = chokidar.watch(srce);
    return new Promise((resolve, reject) => {
        w.on("error", e => reject(e));
        if(waitReady) w.on("ready", () => resolve(w));
        else resolve(w);
    })
}

const srce = path.join(__dirname, "../configuration/src")
const dest = path.join(__dirname, "../configuration/json")

/**
 * Extraie la partie relative à la racine désignée.
 * @param filepath 
 * @returns 
 */
const relative = function(filepath: string){
    return filepath.substring(srce.length);
}

/**Lit le fichier yaml source, le parse en JSON et l'écrit au chemin cible */
const YamlToJson = async function(src: string, dest: string): Promise<void>{
    try {
        const relativePath = replaceExt(path.join(dest, relative(src)), ".json");
        const sfile = await fse.readFile(src, { encoding: "utf-8" });
        const ofile = YAML.parse(sfile);
        const jfile = JSON.stringify(ofile, null, "".padEnd(2, " "));
        await fse.writeFile(relativePath, jfile, { encoding: "utf-8" });
        return Promise.resolve();
    } catch(e: any) { Promise.reject(e); }
}

/**Tente de supprimer le fichier au chemin renseigné. Si le fichier n'existe pas, résout sans rejeter d'erreur. */
const rmJson = async function(filepath: string): Promise<void>{
    try {
        await fse.rm(replaceExt(filepath, ".json"));
        return Promise.resolve();
    } catch(e: any) {
        if(e.code === "ENOENT") return Promise.resolve();
        return Promise.reject(e);
    }
}


const main = async function(){

    const compiler = new Compiler(srce, dest);
    await compiler.init();  

    let error = new Error();
    error.message = chalk.red(`Destination directory '${dest}' forbidden since it is the same as the module directory.`);
    
    if(dest === __dirname) return Promise.reject(error)
    const watcher = await initWatcher(srce, true);
    watcher.on("all", (e, f) => console.log(`event ${e} on filepath ${f}`))

    watcher.on("add", async (f) => await YamlToJson(f, dest))
    watcher.on("addDir", async (f) => await cpyDir(f, dest));
    watcher.on("unlink", async (f) => await rmJson(path.join(dest, relative(f))));
    watcher.on("unlinkDir", async (f) => await fse.rm(path.join(dest, relative(f)), { recursive: true }));
    return Promise.resolve();
}

/**Copie le/les répertoires du chemin source au chemin cible. */
const cpyDir = async function(src: string, dst: string){
    try {
        const relativePath = path.join(dst, relative(src));        
        await fse.mkdir(relativePath, { recursive: true });
        return Promise.resolve();
    } catch(e: any) {
        if(e.code === "ENOENT") return Promise.resolve();
        else return Promise.reject(e);
    }
}



main();