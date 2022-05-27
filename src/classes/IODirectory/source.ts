import { EventEmitter } from "stream";
import chokidar from "chokidar";
import IODirectory from ".";
import { debounce } from "throttle-debounce";
import { filterLowest, keepHighestPaths, TypeGroups } from "../../utils/paths";
import chalk from "chalk";
import fse from "fs-extra";

type TEventPathPair = { event: string, filepath: string };
type TSortedEvents = { added: string[], unlinked: string[], changed: string[] };


/**
 * Represents a source directory.
 * Given a root path, it can find all the filepaths in it.
 * Can watch itself and emit events when any changes are occuring on it.
 */
class Source extends IODirectory {
    private _watcher: chokidar.FSWatcher;
    private eventStack: TEventPathPair[];
    private debouncer: () => void | Promise<void>;
    private event: EventEmitter;

    /**
     * 
     * @param input Root path of the source directory.
     */
    constructor(input: string, debounceTime: number = 250){
        super(input);
        this._watcher = new chokidar.FSWatcher({ ignoreInitial: true });
        this.eventStack = [];
        this.debouncer = debounce(debounceTime, this.filterEvents);
        this.event = new EventEmitter();
    }

    /*** chokidar file watcher*/
    public get watcher(): chokidar.FSWatcher { return this._watcher; };

    /**
     * Verifies : 
     * 1 - If the given source exists
     * 2 - If the given source points to a directory.
     * @returns 
     */
    public async checksource(): Promise<void>{
        try {
            let error = new Error();
            error.message = chalk.red(`The given source '${this.root}' does not exist.`);
            (error as unknown as any).code = "ENOENT_SOURCE";
            if(!(await fse.pathExists(this.root))) return Promise.reject(error);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    public async init(watch: boolean): Promise<void>{
        try {
            await this.checksource();
            await this.updateTree();
            if(!watch) return;
            this.watcher.add(this.root);
            this.watcher.on("ready", () => {
                console.log(`Watching for file changes on path ${chalk.yellow(this.root)}`);
                return Promise.resolve();
            });
            
        } catch(e: any) { return Promise.reject(e); }
    }

    public async watchFiles(): Promise<void>{
        try {
            this.watcher.on("all", (e, p) => {                
                this.eventStack.push({ event: e, filepath: p });
                this.debouncer();
            });
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async filterEvents(): Promise<void>{
        try {
            const { unlinked, added, changed } = separateEvents(this.eventStack);
            if(changed.length > 0) await this.handleChange(changed);
            else if(unlinked.length > 0 && added.length === 0) await this.handleUnlink(unlinked);
            else if(unlinked.length === 0 && added.length > 0) await this.handleAdd(added);
            else if(unlinked.length === added.length) await this.handleRename(unlinked, added);
            else { 
                console.log("I do not know what just happend");
            }
            this.eventStack = [];
            this.updateTree();
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleChange(filepaths: string[]): Promise<void>{
        const groups = await this.segregateTree(filepaths, true);
        this.emit("change", groups);
        return;
    }

    private async handleUnlink(filepaths: string[]): Promise<void>{
        try {
            let groups = this.memSegregateTree(filepaths, true);
            groups = keepHighestPaths(groups);
            this.emit("unlink", groups);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleAdd(filepaths: string[]): Promise<void>{
        try {
            let groups = await this.segregateTree(filepaths, true);
            groups.directories = filterLowest(groups.directories);
            this.emit("add", groups);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private async handleRename(unlinked: string[], added: string[]): Promise<void>{
        const segmentedPairs = SegmentsPairs.splitSegments(sort(unlinked), sort(added));
        let error = chalk.red("Il y a un décallage entre les évènements 'add' et 'unlink'.")
        if(!SegmentsPairs.checkLengths(segmentedPairs)) return console.log(error);
        error = chalk.red("Les différences ne se trouvent pas au même endroit d'un chemin à l'autre.")
        if(!SegmentsPairs.checkIndexes(segmentedPairs)) return console.log(error);
        error = chalk.red("Les différences ne sont pas les mêmes d'un chemin à l'autre.")
        if(!SegmentsPairs.checkDifferenceValues(segmentedPairs)) return console.log(error);
        try {
            const ugroups = this.memSegregateTree(unlinked, true);
            const agroups = await this.segregateTree(added, true);

            const highestU = keepHighestPaths(ugroups);
            const highestA = keepHighestPaths(agroups);

            this.emit("rename", [highestU, highestA]);
            return;
        } catch(e: any) { return Promise.reject(e); }
    }

    private emit(event: "rename", data: [TypeGroups, TypeGroups]): this;
    private emit(event: "change", data: TypeGroups): this;
    private emit(event: "unlink", data: TypeGroups): this;
    private emit(event: "add",    data: TypeGroups): this;
    private emit(event: "change" | "unlink" | "add" | "rename", data: any): this{
        if(["add", "change", "unlink"].includes(event)) this.event.emit("acu", event, data);
        this.event.emit(event, data);
        return this;
    }

    public on(event: "rename", cb: (data: [TypeGroups, TypeGroups]) => void): this;
    public on(event: "acu", cb: (event: "add" | "change" | "unlink", data: TypeGroups) => void): this;
    public on(event: "change", cb: (data: TypeGroups) => void): this;
    public on(event: "unlink", cb: (data: TypeGroups) => void): this;
    public on(event: "add", cb: (data: TypeGroups) => void): this;
    public on(event: "change" | "unlink" | "add" | "rename" | "acu", cb: (...data: any) => void): this{
        this.event.on(event, cb);
        return this;
    }
}

/**
 * Separatates the given event stack into (added | unlinked | changed) events
 * @param stack 
 * @returns 
 */
 const separateEvents = function (stack: TEventPathPair[]): TSortedEvents{
    const added = sort(stack.filter(({ event }) => ["add", "addDir"].includes(event)).map(({ filepath }) => filepath));
    const unlinked = sort(stack.filter(({ event }) => ["unlink", "unlinkDir"].includes(event)).map(({ filepath }) => filepath));
    const changed = sort(stack.filter(({ event }) => ["change"].includes(event)).map(({ filepath }) => filepath));
    return { added, unlinked, changed };
}

const sort = (array: string[]): string[] => array.sort((a, b) => a.localeCompare(b));

namespace SegmentsPairs {
    type TSegmentsPair = { u: string[], a: string[] };
    type TSegmentsPairIndexed = TSegmentsPair & { i: number[] };

    /**
     * Vérifie :
     * 
     * - Que chaque chemin d'une paire possède le même nombre de segments
     * - Que ce nombre de segments vaut au moins `1`
     * @param pairs 
     * @returns 
     */
    export const checkLengths = function(pairs: TSegmentsPair[]): boolean{
        const checkSingle = function(pair: TSegmentsPair): boolean{
            const { u, a } = pair;
            return (!(u.length !== a.length || u.length < 1))
        }
        return !pairs.some(p => !checkSingle(p));
    }

    export const splitSegments = function(unlinked: string[], added: string[]): TSegmentsPair[]{
        const createSinglePair = (u: string, a: string): TSegmentsPair => ({ u: u.split("/"), a: a.split("/") });
        unlinked = sort(unlinked);
        added = sort(added);
        const pairs: TSegmentsPair[] = unlinked.map((v, i) => createSinglePair(unlinked[i], added[i]));
        return pairs;
    }

    const findIndexes = function(pairs: TSegmentsPair[]): TSegmentsPairIndexed[]{
        const indexesOnSingle = (pair: TSegmentsPair): TSegmentsPairIndexed => {
            const { u, a } = pair;
            const i: number[] = []
            u.forEach((v, j) => { if(u[j] !== a[j]) i.push(j); });            
            return { u, a, i }
        }
        return pairs.map(element => indexesOnSingle(element));
    }

    /**
    * Vérifie :
    * 
    * - Que toutes les paires ne possèdent qu'un seul index de différence.
    * (Ce qui signifie qu'il n'y a qu'un seul segment de différent par paire).
    * - Que tous les indexes possèdent la même valeur
    * (Ce qui signifie que la différence se situe sur le même segment d'une paire à l'autre).
    * @param pairs 
    * @returns 
    */
    export const checkIndexes = function(pairs: TSegmentsPair[]): boolean{
        const idx = findIndexes(pairs).map(({i}) => i);
        return !idx.some(({ length }) => length !== 1) && !idx.some(diff => diff[0] !== idx[0][0]);
    }

    /**
     * Vérifie que la différence sur chaque paire de chemin est la même partout.
     * @param pairs 
     * @returns 
     */
    export const checkDifferenceValues = function(pairs: TSegmentsPair[]): boolean{
        const idx = findIndexes(pairs);
        const adiff: string[] = idx.map(element => element.a[element.i[0]])
        const udiff: string[] = idx.map(element => element.u[element.i[0]])
        const adiffok = !adiff.some((v, i) => adiff[i] !== adiff[0]);
        const udiffok = !udiff.some((v, i) => udiff[i] !== udiff[0]);        
        return adiffok && udiffok;
    }
}

export default Source;