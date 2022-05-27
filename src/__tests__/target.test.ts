import Target from "../classes/IODirectory/target";
// import fse from "fs-extra";
//! Virtualisation du système de fichiers.
import mock from "mock-fs";
import path from "path";
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
describe("Target class", () => {
    const TESTFILES = path.join(FILE_ROOT, "target.test");

    testVirtualFS();
    describe("method checktarget", () => {
        const validtarget = path.join(TESTFILES, "target");
        const targetenoent = path.join(TESTFILES, "enoentdir");
        const targetapproot = APPROOT;
        it("Should resolve if the given target path does not exist", async () => {
            const target = new Target(targetenoent);
            expect.assertions(1);
            await expect(target.checktarget()).resolves.toBeUndefined();
        })

        it("Should reject if the given path is the same as the module root.", () => {
            const target = new Target(targetapproot);
            expect.assertions(1);
            return target.checktarget().catch(e => expect(e.code).toBe("ESAME_AS_ROOT"));
        })

        it("Should resolve otherwise", async () => {
            const target = new Target(validtarget);
            expect.assertions(1);
            await expect(target.checktarget()).resolves.toBeUndefined();
        })
    })
    
})