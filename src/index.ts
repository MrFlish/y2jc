import { Compiler } from "./classes/compiler";
import Source from "./classes/IODirectory/source";
import Target from "./classes/IODirectory/target";
import { ModuleConfiguration } from "./classes/configuration";
import { configurationSchema } from "./validation/configurationSchemas";

const main = async function(){   
    const configuration = new ModuleConfiguration("json.compiler.yaml", configurationSchema);
    await configuration.find(__dirname, 5);
    await configuration.load();
    const options = configuration.options;
    const files = configuration.files;
    for(const pair of files){
        const compiler = new Compiler(new Source(pair.source), new Target(pair.target), options);
        await compiler.init();
        await compiler.watch();
    }
    return;
}
main();