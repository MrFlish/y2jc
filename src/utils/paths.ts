import path from "path";
import { Directory, SimpleFile } from "../classes/files";
import fse from "fs-extra";


export type TRecursiveOptions = { filter?: string[], files?: string[] };
export type TypeGroups = { files: SimpleFile[], directories: Directory[] };


/**
* Returns the number of file separators contained in the specified path.
* If the string ends with a separator, it ignores it.
* @param filepath 
* @returns 
* @exmaple ```
* countDepts("/a/path/to/some/directory/")
* // => 5
* ```
*/
export const countDepth = (filepath: string): number => path.resolve(filepath).split(path.parse(filepath).root).length - 1; 

/**
* A given path list, returns a sorted copy of the path from the
* farthest to the root of the file system, to the closest
* @param paths 
* @param dec If `true`, reverse the sort. The paths closest from the root will be first.
* @returns 
*/
export const sortPathsByDepth = (paths: string[], dec: boolean = false) => paths.sort((a, b) =>
    dec ? (countDepth(a) - countDepth(b)) : (countDepth(b) - countDepth(a))
)

/**
 * Given a list of paths, finds and returns the highest paths in the file tree.
 * @param paths List of paths
 * @returns A list of the highest paths
 * ```
 * const paths = [
 *  "/a/path/to/some/directory",
 *  "/another/directory/",
 *  "/a/path/",
 *  "/another/directory/that/contains/stuff",
 *  "some/other/path"
 * ]
 * filterHighestCommonDirectories(paths)
 * // => ["/a/path", "/another/directory", "some/other/path"]
 * ```
 */
 export const filterHighestCommonPaths = function(paths: string[]): string[]{
    const hcd: string[] = [];
    //Sorts the paths so the closest
    const sorted = sortPathsByDepth(paths);
    for(let i = 0; i < sorted.length - 1; ++i){
        const related: string[] = [];
        for(let j = i + 1; j < sorted.length; ++j){
            if(sorted[i].indexOf(sorted[j]) === 0) related.push(sorted[j]);
        }
        //? Saves only the last element (the closest to the root).
        if(related.length > 0) hcd.push(related[related.length - 1]);
    }
    return [...new Set(hcd)];
}

/**
 * Given a list of paths, finds and returns the lowest paths in the file tree.
 * @param paths List of paths
 * @returns A list of the lowest paths
 * @example 
 * ```
 * const paths = [
 *  "/a/path/to/some/directory",
 *  "/another/directory/",
 *  "/a/path/",
 *  "/another/directory/that/contains/stuff",
 *  "some/other/path"
 * ]
 * filterHighestCommonDirectories(paths)
 * // => ["/a/path/to/some/directory", "/another/directory/that/contains/stuff", "some/other/path"]
 * ```
 */
 export const filterLowestCommonPaths = function(paths: string[]): string[]{
    //Sorts the list so the deepest paths are the first.
    const sorted = sortPathsByDepth(paths);
    for(let i = 0; i < sorted.length; ++i){
        for(let j = i + 1; j < sorted.length; ++j){
            if(sorted[i].indexOf(sorted[j]) === 0) sorted.splice(j, 1);
        }
    }
    return [...new Set(sorted)];
}

export const sortByDepth = (paths: Directory[], inc: boolean = false): Directory[] => {
    return paths.sort((a, b) => inc ? 
        (countDepth(a.relative) - countDepth(b.relative)) : 
        (countDepth(b.relative) - countDepth(a.relative))
    );
    // paths.sort((a, b) => dec ? (countDepth(a) - countDepth(b)) : (countDepth(b) - countDepth(a))
}


export const filterHighest = function(paths: Directory[]): Directory[]{
    const hcd: Directory[] = [];
    const sorted = sortByDepth(paths);
    for(let i = 0; i < sorted.length; ++i){
        const p = sorted[i];
        const related: Directory[] = [p];
        for(let j = i; j < sorted.length; ++j){
            const sub = sorted[j];
            if(p.relative.indexOf(sub.relative) === 0) related.push(sub);
        }
        hcd.push(related[related.length - 1])
    }
    return [...new Set(hcd)];
}

export const filterLowest = function(paths: Directory[]): Directory[]{
    //Sorts the list so the deepest paths are the first.
    const sorted = sortByDepth(paths);
    for(let i = 0; i < sorted.length; ++i){
        for(let j = i + 1; j < sorted.length; ++j){
            if(sorted[i].relative.indexOf(sorted[j].relative) === 0) sorted.splice(j, 1);
        }
    }
    return [...new Set(sorted)];
}


/**
 * Lists recursively all paths in the given directory
 * @param start Directory where to start searching for all paths
 * @param options 
 * @returns 
 */
export const recursiveList = async function (start: string, options: TRecursiveOptions = {}): Promise<string[]>{        
    try {
        let files  = options.files  || [];
        const filter = (options.filter || []).map(f => f.indexOf('.') === 0 ? f : '.' + f);
        const currdir = await fse.readdir(start);
        for(const f of currdir){
            const filepath = path.join(start, f);
            if(!(await fse.stat(filepath)).isDirectory()){
                if(filter.length <= 0) files.push(filepath);
                else { if(filter.includes(path.extname(filepath))) files.push(filepath); }
            }
            else {
                files = await recursiveList(filepath, { files, filter });
                files.push(filepath);
            }
        }
        return files;
    } catch(e: any) { throw e; }
}

export const keepHighestPaths = function(paths: TypeGroups): TypeGroups{
    paths.directories = filterHighest(paths.directories);
    if(paths.directories.length < 1) return paths;
    const files: SimpleFile[] =  [];
    for(let i = 0; i < paths.directories.length; ++i){
        const d = paths.directories[i].relative;
        for(let j = 0; j < paths.files.length; ++j){
            const f = paths.files[j].relative;
            if(f.indexOf(d) !== 0) files.push(paths.files[j]);
        }
    }
    return { directories: paths.directories, files };
}