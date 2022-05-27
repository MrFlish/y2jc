import path from "path";
import { Compiler } from "./classes/compiler_save";

const srce = path.join(__dirname, "../configuration/src")
const dest = path.join(__dirname, "../configuration/json")

const main = async function(){

    const compiler = new Compiler(srce, dest);
    await compiler.init();
    await compiler.watch();

    return Promise.resolve();
}


main();