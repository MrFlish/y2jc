import path from "path";
import { Compiler } from "./classes/compiler";
import Source from "./classes/IODirectory/source";
import Target from "./classes/IODirectory/target";

const srce = path.join(__dirname, "../configuration/src")
const trgt = path.join(__dirname, "../configuration/json")

const main = async function(){

    const source = new Source(srce);
    const target = new Target(trgt)
    const compiler = new Compiler(source, target);
    await compiler.init();
    await compiler.watch();

    return Promise.resolve();
}


main();