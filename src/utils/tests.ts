import mock from "mock-fs";
import { DirectoryItems } from "mock-fs/lib/filesystem";
import path from "path";
import fse from "fs-extra";
import { APPROOT } from "../ROOT";

export const FILE_ROOT = "memory/files";
export const json: DirectoryItems = {
    "memory": { "files": mock.load(path.join(APPROOT, "./tests/files"), { recursive: true }) }
};

export const testVirtualFS = function(){
    return it("should use Virtual FS instead of the real one", async () => {
        expect(await fse.readdir(FILE_ROOT)).not.toEqual([]);
    })
}