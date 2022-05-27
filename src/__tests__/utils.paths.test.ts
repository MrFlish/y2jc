import { Directory } from "../classes/files";
import { countDepth, filterHighest, filterHighestCommonPaths, filterLowestCommonPaths, sortPathsByDepth } from "../utils/paths"

describe("path utils functions", () => {
    describe("countDepth function", () => {
        it("Should return the right amount of separators in the given path", () => {
            expect(countDepth("/path/to/a/random/file")).toBe(5);
        })

        it("Shouldn't count the last separator if it's the last carracter of the string", () => {
            expect(countDepth("/path/to/a/random/file/")).toBe(5);
        })
    })

    describe("sortPathsByDepth function", () => {
        const paths = ["/some/path/to/a/random/file", "/some/path/to/another/random/nested/file", "/root", "/some/path"];

        it("Should return a sorted copy of given paths from the nearest path from the root to the closest", () => {
            const expected = [
                "/some/path/to/another/random/nested/file", "/some/path/to/a/random/file",
                "/some/path", "/root"
            ]
            expect(sortPathsByDepth(paths)).toEqual(expected);
        })

        it("If dec parameter is set to true, Should return a sorted copy of given paths from the closest path from the root to the nearest", () => {
            const expected = [
                "/root", "/some/path",
                "/some/path/to/a/random/file", "/some/path/to/another/random/nested/file"
            ]
            expect(sortPathsByDepth(paths, true)).toEqual(expected);
        })
    })

    describe("filterHighestCommonPaths function", () => {
        it("Should return only the nearest paths from the root", () => {
            const paths = [
                "/some/path/to/a/random/file", "/some/path/to/another/random/nested/file",
                "/root", "/some/path", "/root/of/the/file/system"
            ];

            const expected = [ "/some/path", "/root" ];
            expect(filterHighestCommonPaths(paths)).toEqual(expected);
        })
    })

    describe("filterLowestPaths function", () => {
        it("Should return only the farthest paths from the root", () => {
            const paths = [
                "/some/path/to/a/random/file", "/some/path/to/another/random/nested/file",
                "/root", "/some/path", "/root/of/the/file/system", "/a/different/dir",
                "/a/different/dir/that/goes/deeper"
            ];

            const expected = [
                "/some/path/to/another/random/nested/file", "/some/path/to/a/random/file",
                "/a/different/dir/that/goes/deeper", "/root/of/the/file/system"
            ];

            expect(filterLowestCommonPaths(paths)).toEqual(expected);
        })
    })

    describe("filterHighest function", () => {
        it("Should return only the nearest paths from the root", () => {
            const spaths = [
                "/some/path/to/a/random/file", "/some/path/to/another/random/nested/file",
                "/root", "/some/path", "/root/of/the/file/system"
            ];
            const paths = spaths.map(f => new Directory(f, ""));
            const expected = [ "/some/path", "/root" ];


            expect(filterHighest(paths).map(({ relative }) => relative)).toEqual(expected);
        })

        it("If no related paths are found returns the specified paths", () => {
            const spaths = [
                "/some/path/to/a/random/file",
                "/some/path/to/another/random/nested/file",
                "/root/of/the/file/system"
            ];
            const paths = spaths.map(f => new Directory(f, ""));
            const expected = [ 
                "/some/path/to/another/random/nested/file",
                "/some/path/to/a/random/file",
                "/root/of/the/file/system"
            ];
            expect(filterHighest(paths).map(({ relative }) => relative)).toEqual(expected);
        })

        it("If the given paths contain only one path, returns it", () => {
            const spaths = ["/some/path/to/a/random/file"];
            const paths = spaths.map(f => new Directory(f, ""));
            expect(filterHighest(paths).map(({ relative }) => relative)).toEqual(spaths);
        })
    })
})