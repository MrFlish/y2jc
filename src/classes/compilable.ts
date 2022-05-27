import path from "path";
import { SimpleFile } from "./files";

const COMPILABLE_EXTENSIONS = [".yaml", ".json"];
abstract class Compilable {
    protected readonly _compilableExtensions: Set<string>;
    constructor(){
        this._compilableExtensions = new Set(COMPILABLE_EXTENSIONS.map(e => this.resolveExtension(e)));
    }

    public get compilableExtensions(): Set<string> { return this._compilableExtensions; };

    public addCompilableExtension(extension: string): this{
        this.compilableExtensions.add(this.resolveExtension(extension));
        return this;
    }
    public removeCompilableExtension(extension: string): this{
        this.compilableExtensions.delete(this.resolveExtension(extension));
        return this;
    }

    protected isCompilable(file: string | SimpleFile): boolean{
        const p = (file instanceof SimpleFile) ? file.relative : file;
        return this.compilableExtensions.has(path.extname(p));
    }

    private resolveExtension(extension: string): string{
        if(extension.indexOf('.') === 0) return extension
        else return `.${extension}`;
    }
}

export default Compilable;