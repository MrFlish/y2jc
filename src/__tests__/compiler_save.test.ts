console.log(null);
import fse from "fs-extra";
//! Virtualisation du système de fichiers.
import mock from "mock-fs";
import path from "path";
import { Compiler } from "../classes/compiler_save";
import { APPROOT } from "../ROOT";
import { FILE_ROOT, json, testVirtualFS } from "../utils/tests";
//!====================


beforeAll(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
})

beforeEach(() => mock(json));
afterEach(() => mock.restore())

afterAll(() => {
    mock.restore();
    jest.resetAllMocks();
    jest.restoreAllMocks();
})

describe("Compiler class", () => {
    describe("Private verify() method", () => {
        testVirtualFS();
        const srceNotDir = path.join(FILE_ROOT, "wrong.file.txt");
        const srceEnoent  =  path.join(FILE_ROOT, "thisDirDoesNotExist/");
        const destIsApp =  path.join(APPROOT);
        const destIsSrce =  path.join(FILE_ROOT, "lvl1/lvl2");
        const goodSrce = path.join(FILE_ROOT, "lvl1");
        const goodDest = path.join(FILE_ROOT, "output");

        it("Should reject if the given source does not exist", () => {
            const compiler = new Compiler(srceEnoent, "");
            expect.assertions(1);
            return compiler["verifyPaths"]().catch(e => expect(e).not.toBeUndefined());
        })

        it("Should reject if the given source is not a directory.", () => {
            const compiler = new Compiler(srceNotDir, "");
            expect.assertions(1);
            return compiler["verifyPaths"]().catch(e => expect(e).not.toBeUndefined());
        })

        it("Should reject if the given destination leads to the application root", () => {
            const compiler = new Compiler(goodSrce, destIsApp);
            expect.assertions(1);
            return compiler["verifyPaths"]().catch(e => expect(e).not.toBeUndefined());
        })

        it("Should reject if the given directory is the same as the given source.", () => {
            const compiler = new Compiler(destIsSrce, destIsSrce);
            expect.assertions(1);
            return compiler["verifyPaths"]().catch(e => expect(e).not.toBeUndefined());
        })

        it("Should resolve otherwise", () => {
            const compiler = new Compiler(goodSrce, goodDest);
            expect.assertions(1);
            return compiler["verifyPaths"]().then(() => expect(true).toBe(true));
        })
    })

    describe("private recursivelist() method", () => {
        const srce = path.join(FILE_ROOT, "lvl1/recursive");
        const dest = path.join(FILE_ROOT, "output");
        const compiler = new Compiler(srce, dest);
        const sort = (arr: string[]): string[] => arr.sort((a, b) => a.localeCompare(b));
        testVirtualFS();
        it("Should return all the filepaths present in the given path", () => {
            const expected = [
                path.join(FILE_ROOT, "lvl1/recursive/dir1"),
                path.join(FILE_ROOT, "lvl1/recursive/dir2"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/dir11"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/blacklistedfile.txt"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/yamlfile.yaml"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/jsonfile.json"),
            ];
            expect.assertions(1);
            return compiler["recursiveList"](srce).then(l => expect(sort(l)).toEqual(sort(expected)));
        })
        it("If filter is given, returns only the files that match the specified extensions", async () => {
            const expected = [
                path.join(FILE_ROOT, "lvl1/recursive/dir1"),
                path.join(FILE_ROOT, "lvl1/recursive/dir2"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/dir11"),
                path.join(FILE_ROOT, "lvl1/recursive/dir1/yamlfile.yaml"),
            ];
            expect.assertions(2);
            let results = await compiler["recursiveList"](srce, { filter: ["yaml"]});
            expect(sort(results)).toEqual(sort(expected));

            results = await compiler["recursiveList"](srce, { filter: ["yaml", ".json"] });
            expect(sort(results)).toEqual(sort([...expected, path.join(FILE_ROOT, "lvl1/recursive/dir1/jsonfile.json")]));
        })
    })

    describe("private removeDirectory() method", () => {
        const srce = path.join(FILE_ROOT, "lvl1/");
        const dest = path.join(FILE_ROOT, "output");
        const compiler = new Compiler(srce, dest);
        const sort = (arr: string[]): string[] => arr.sort((a, b) => a.localeCompare(b));
        testVirtualFS();
        it("Should remove the given directory", async () => {
            expect.assertions(2);
            try {
                let dir = await fse.readdir(srce);
                expect(sort(dir)).toEqual(sort(["lvl2", "recursive"]));
                await compiler["removeDirectory"](path.join(srce, "lvl2"));
                dir = await fse.readdir(srce);
                expect(sort(dir)).toEqual(["recursive"]);
            } catch(e: any) { expect("This should have reolved").toBe(false); }
        })

        it("Should resolve, even if the directory does not exist.", async () => {
            expect.assertions(2);
            try {
                let dir = await fse.readdir(srce);
                expect(sort(dir)).toEqual(sort(["lvl2", "recursive"]));
                await compiler["removeDirectory"](path.join(srce, "doesnotexist"));
                dir = await fse.readdir(srce);
                expect(sort(dir)).toEqual(sort(["lvl2", "recursive"]));
            } catch(e: any) { expect("This should have reolved").toBe(false); }
        })

        it("Should also remove nested directories (recursive rm)", async () => {
            expect.assertions(2);
            const source = path.join(srce, "recursive");
            try {
                let dir = await fse.readdir(path.join(source, "dir1"));
                expect(sort(dir).includes("dir11")).toBe(true);
                await compiler["removeDirectory"](path.join(srce, "dir1"));
                dir = await fse.readdir(srce);
                expect(sort(dir).includes("dir1")).toBe(false);
            } catch(e: any) { expect("This should have reolved").toBe(false); }
        })
    })
})