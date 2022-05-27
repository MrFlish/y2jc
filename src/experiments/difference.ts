const findDiff = function(str1: string, str2: string) {
    let diff = "";
    str2.split('').forEach(function(val, i) {
      if (val != str1.charAt(i)) diff += val;
    });
    return diff;
  }

const difference = function(a: string, b: string): string {
    let difference: string = "";
    b.split("").every((char, i) => {
        if(char !== a.charAt(i)) {
            difference += char;
            return true;
        }
        if(char !== a.charAt(i) && char === '/') return false;
        else return true
    })
    return difference;
}

let diff = difference("/some/path/to/directory1/leading/to/some/file", "/some/path/to/directory2/leading/to/some/file");
console.log(diff);
  