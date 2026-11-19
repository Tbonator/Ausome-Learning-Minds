export async function privateInput(label) {
  if (!process.stdin.isTTY) throw new Error('Run this command in your own terminal to enter the app password privately.');
  process.stdout.write(label);
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise(resolve => {
    let value = '';
    const listener = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') {process.stdin.setRawMode(false); process.stdout.write('\nCancelled.\n'); process.exit(1);}
        if (char === '\r' || char === '\n') {
          process.stdin.off('data',listener); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); resolve(value); return;
        }
        if (char === '\u007f' || char === '\b') {if (value) {value = [...value].slice(0,-1).join(''); process.stdout.write('\b \b');}}
        else if (char >= ' ' && value.length < 256) {value += char; process.stdout.write('*');}
      }
    };
    process.stdin.on('data',listener);
  });
}
