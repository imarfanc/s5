const PORT = 3000;

console.log("\x1b[1m\x1b[36mseeding\x1b[0m");
const response = await fetch(`http://localhost:${PORT}/notes`);
console.log(`\x1b[2mgot ${(await response.json()).length} notes\x1b[0m`);
