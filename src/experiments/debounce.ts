import { debounce } from "throttle-debounce";

const deb = debounce(1000, (num: number) => {
    console.log(`the number is ${num}`);
})

deb(55)
deb(56)
deb(57)
deb(58)


setTimeout(() => deb(8), 1200)
setTimeout(() => deb(42), 2400)