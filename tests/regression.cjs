// Backward-compatible entry point. The suite now runs against a real DOM.
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','tests/app.test.cjs'],{stdio:'inherit'});
process.exitCode=result.status??1;
