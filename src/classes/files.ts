import path from "path";
import replaceExt from "replace-ext";

abstract class AbstractFileClass
{
    private _absolute: string;
    private _fromRoot: string;

    constructor(filepath: string, from: string){
        this._absolute = filepath;
        this._fromRoot = from;
    }
    public get absolute(): string { return this._absolute };
    public get relative(): string { return this.relativeTo(this._absolute, this._fromRoot) };

    private relativeTo(filepath: string, from: string){
        return filepath.substring(from.length);
    }

    public absoluteFrom(from: string): string{
        return path.join(from, this.relative);
    }
}

/**
 * Representation of a directory.
 */
export class Directory extends AbstractFileClass
{
    constructor(filepath: string, from: string){
        super(filepath, from);
    }
}

/**
 * Representation of a file
 */
export class SimpleFile extends AbstractFileClass
{
    private _basename: string;
    private _extension: string;
    constructor(filepath: string, from: string){
        super(filepath, from);
        this._basename = "";
        this._extension = path.extname(filepath);
    }
    public get absoluteBase(): string { return replaceExt(this.absolute, "") };
    public get relativeBase(): string { return replaceExt(this.relative, "") };
    public get basename(): string { return this._basename };
    public get extension(): string { return this._extension };

    public absoluteBaseFrom(from: string): string {
        return path.join(from, this.relativeBase);
    }
}