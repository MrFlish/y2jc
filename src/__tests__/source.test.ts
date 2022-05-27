import Source from "../classes/IODirectory/source";
// import fse from "fs-extra";
//! Virtualisation du système de fichiers.
import mock from "mock-fs";
import path from "path";
import { FILE_ROOT, json, testVirtualFS } from "../utils/tests";
import { Directory, SimpleFile } from "../classes/files";
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

describe("Source class", () => {
    const sort = (array: string[]): string[] => array.sort((a, b) => a.localeCompare(b));
    const TESTFILES = path.join(FILE_ROOT, "source.test");

    testVirtualFS();
    describe("method checksource", () => {
        const validsource = TESTFILES;
        const wrongsource = path.join(TESTFILES, "wrongsource");
        const filesource = path.join(TESTFILES, "file.txt");
        it("Should reject if the given source path does not exist", () => {
            const source = new Source(wrongsource);
            expect.assertions(1);
            return source.checksource().catch(e => expect(e.code).toBe("ENOENT_SOURCE"));
        })

        it("Should reject if the given path leads to a simple file", () => {
            const source = new Source(filesource);
            expect.assertions(1);
            return source.checksource().catch(e => expect(e.code).toBe("ENOENT_SOURCE"));
        })

        it("Should resolve otherwise", async () => {
            const source = new Source(validsource);
            expect.assertions(1);
            await expect(source.checksource()).resolves.toBeUndefined();
        })
    })

    describe("private scanTree method", () => {
        it("Should return all the filepaths in the target directory", () => {
            let expected = [
                path.join(TESTFILES, "directory1"),
                path.join(TESTFILES, "directory1", "nested"),
                path.join(TESTFILES, "directory1", "nested", "file.txt"),
                path.join(TESTFILES, "directory1", "nested", "file.json"),
                path.join(TESTFILES, "directory1", "file.json"),
                path.join(TESTFILES, "directory1", "file.yaml"),
                path.join(TESTFILES, "directory1", "file.txt"),
                path.join(TESTFILES, "directory2")
            ]
            expected = sort(expected);
            expect.assertions(1);
            const source = new Source(TESTFILES);
            return source["scanTree"]().then(list => expect(sort(list)).toEqual(expected))
        })

        it("If filter option is set to ['.yaml'] only returns the directories and the files with .yaml extension", () => {
            let expected = [
                path.join(TESTFILES, "directory1"),
                path.join(TESTFILES, "directory1", "nested"),
                path.join(TESTFILES, "directory1", "file.yaml"),
                path.join(TESTFILES, "directory2")
            ]
            expected = sort(expected);
            expect.assertions(1);
            const source = new Source(TESTFILES);
            return source["scanTree"]({ filter: [".yaml"]}).then(list => expect(sort(list)).toEqual(expected));
        })
        it("If filter option is set to ['yaml'] (without a '.') only returns the directories and the files with .yaml extension", () => {
            let expected = [
                path.join(TESTFILES, "directory1"),
                path.join(TESTFILES, "directory1", "nested"),
                path.join(TESTFILES, "directory1", "file.yaml"),
                path.join(TESTFILES, "directory2")
            ]
            expected = sort(expected);
            expect.assertions(1);
            const source = new Source(TESTFILES);
            return source["scanTree"]({ filter: ["yaml"]}).then(list => expect(sort(list)).toEqual(expected));
        })

        it("If filter option is set to ['.yaml', 'json] only returns the directories and the files with .yaml/.json extension", () => {
            let expected = [
                path.join(TESTFILES, "directory1"),
                path.join(TESTFILES, "directory1", "nested"),
                path.join(TESTFILES, "directory1", "nested", "file.json"),
                path.join(TESTFILES, "directory1", "file.json"),
                path.join(TESTFILES, "directory1", "file.yaml"),
                path.join(TESTFILES, "directory2")
            ]
            expected = sort(expected);
            expect.assertions(1);
            const source = new Source(TESTFILES);
            return source["scanTree"]({ filter: [".yaml", "json"]}).then(list => expect(sort(list)).toEqual(expected));
        })
    })

    describe("private segregateTree method", () => {
        const source = new Source(TESTFILES);
        it("Should return an object containing a 'files' and 'directories' key.", async () => {
            expect.assertions(1);
            const list = await source["scanTree"]();
            const group = await source["segregateTree"](list);
            expect(sort(Object.keys(group))).toEqual(["directories", "files"])
        })
        
        it("Sould have separated files and directories into the corresponding key as string arrays", async () => {
            const expectedDirecories = [
                path.join(TESTFILES, "directory1"),
                path.join(TESTFILES, "directory1", "nested"),
                path.join(TESTFILES, "directory2")
            ]
            const expectedFiles = [
                path.join(TESTFILES, "directory1", "nested", "file.txt"),
                path.join(TESTFILES, "directory1", "nested", "file.json"),
                path.join(TESTFILES, "directory1", "file.json"),
                path.join(TESTFILES, "directory1", "file.yaml"),
                path.join(TESTFILES, "directory1", "file.txt"),
            ]

            expect.assertions(2);
            const list = await source["scanTree"]();
            const group = await source["segregateTree"](list);
            expect(sort(group.directories)).toEqual(sort(expectedDirecories))
            expect(sort(group.files)).toEqual(sort(expectedFiles))
        })

        it("If asobj option is true, returns the files/directories into the corresponding key as 'SimpleFile' and 'Directory' instance arrays", async () => {
            expect.assertions(2);
            const list = await source["scanTree"]();
            const groups = await source["segregateTree"](list, true);
            expect(groups.directories[0] instanceof Directory).toBe(true);
            expect(groups.files[0] instanceof SimpleFile).toBe(true);
        })
    })

    describe("Private updateTree method", () => {
        const source = new Source(TESTFILES);
        it("Should populate the 'files' and 'directories' properties.", async () => {
            expect.assertions(4);
            expect(source.files.length).toBe(0);
            expect(source.directories.length).toBe(0);
            await source["updateTree"]();
            expect(source.files.length).toBeGreaterThan(0);
            expect(source.directories.length).toBeGreaterThan(0);
        })
    })
})