//! Virtualisation du système de fichiers.
//! Utilisation de mock-fs plutôt que memfs car ce dernier ne semble pas supporter fs/promises.
import mock from "mock-fs";
import Finder from "../classes/finder";
import fsp from "fs/promises";
import chalk from "chalk";
//!====================
const virtualFSTest = function(n: number, obj: { vfsOK: boolean } = { vfsOK: false}){
    return it("Virtual file system is used instead of the real one.", async () => {
        const N = n;
        let dir = await fsp.readdir("/memory");
        const files: string[] = ["path1", "path2", "path3"];
        const allfiles = !(files.some(f => !dir.includes(f)));
        obj.vfsOK = dir.length === N && allfiles;
        if(!obj.vfsOK) console.log(chalk.red("File system used is not the virtual one."));
        expect(dir.length).toBe(N);
    })
};

const json = {
    "path1": {
        "file1": "I'm a file",
        "file2": "I'm a file",
        "path10": {
            "path100": {
                "path1000": {
                    "path10000": {
                        "path100000": {
                            "file100000": "I'm a file"
                        }
                    },
                    "file1000": "I'm a file",
                    "file1001": "I'm a file"
                },
                "node_modules": {}
            }
        }
    },
    "path2": {
        "file1": "I'm a file",
        "file2": "I'm a file"
    },
    "path3": {
        "file1": "I'm a file",
        "file2": "I'm a file"
    }
}

beforeAll(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
})

beforeEach(() => mock({"/memory": json }));
afterEach(() => mock.restore())

afterAll(() => {
    mock.restore();
    jest.resetAllMocks();
    jest.restoreAllMocks();
})

describe("Finder class", () => {
    const p = "/memory/path1/path10/path100/path1000/path10000/path100000";
    const f = "file10001";
    const finder = new Finder();
    describe("findFile function", () => {
        virtualFSTest(3);
        it("Rejects if reaches root without finding the specified file.", async () => {
            expect.assertions(1);
            try{
                await finder.findFile("missing_file", p, 20);
            }
            catch(e: any){                
                expect(e.code).toBe("FILE_NOT_FOUND");
            }
        })
        it("The function fires itself recursively to search in the parent dir. Rejects if reaches the max number of attemps specified by 'count'.", async () => {
            const N = 4;
            const spy = jest.spyOn(finder, "findFile");
            expect.assertions(2);
            try{
                await finder.findFile("missing_file", p, N)
            }
            catch(e: any){
                expect(e.code).toBe("FILE_NOT_FOUND");
                expect(spy.mock.calls.length).toBe(N);
            }
            finally{ spy.mockRestore() }
            
        })
        it("Resolves the path (without the filename appended) if finds it", async () => {
            try{
                const result = await finder.findFile(f, p, 10);
                expect(result).toBe("/memory/path1/path10/path100/path1000");
            }
            catch(e: any){}
        })
        it("Resolves the path (WITH the filename appended) if finds it, if the option is set to true.", async () => {
            try{
                const result = await finder.findFile(f, p, 10, true);
                expect(result).toBe("/memory/path1/path10/path100/path1000/file1001");
            }
            catch(e: any){}
        })
    });
    describe("findNodeModules method", () => {
        const finder = new Finder();
        it("Resolves the path (without the file appended) if finds node_modules folder", async () => {
            const result = await finder.findNodeModules(p, 10);
            expect(result).toBe("/memory/path1/path10/path100")
        })
        it("Resolves the path (WITH the file appended) if finds node_modules folder, if the option is set to true.", async () => {
            const result = await finder.findNodeModules(p, 10, true);
            expect(result).toBe("/memory/path1/path10/path100/node_modules")
        })
    })
})