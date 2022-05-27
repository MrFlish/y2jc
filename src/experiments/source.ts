import path from "path";
import Source from "../classes/IODirectory/source";


const main = async function(){
    const source = new Source(path.join(__dirname, "../tests/files/source.test"));
    const list = await source["scanTree"]();
    const group = await source["segregateTree"](list, false);
    const ogroup = await source["segregateTree"](list, true);
    console.log(group);
    console.log(ogroup.files.map(f => f.absolute));
    console.log(ogroup.directories.map(f => f.absolute));
    
}

main();