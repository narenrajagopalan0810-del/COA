/**
 * FlynnSim - Custom Assembly IDE Controller (editor.html)
 * 
 * Provides an interactive assembly programming studio with:
 * - TinyISA syntax assembly and verification
 * - Architecture target selection (SISD, SIMD, MIMD)
 * - Single-step microarchitectural execution & register debugging
 */

document.addEventListener('DOMContentLoaded', () => {
    let targetArch = 'SISD';
    let archInstance = new SISDArchitecture();
    let isRunning = false;
    let clockTimer = null;

    const codeArea = document.getElementById('custom-assembly-code');
    const selectArch = document.getElementById('custom-target-arch');
    const btnAssemble = document.getElementById('btn-assemble-custom');
    const statusBox = document.getElementById('custom-editor-status');

    const btnStep = document.getElementById('btn-step');
    const btnRun = document.getElementById('btn-run');
    const btnReset = document.getElementById('btn-reset');

    const regR0 = document.getElementById('reg-r0');
    const regR1 = document.getElementById('reg-r1');
    const regR2 = document.getElementById('reg-r2');
    const regR3 = document.getElementById('reg-r3');
    const regPC = document.getElementById('reg-pc');
    const regZF = document.getElementById('reg-zf');

    const traceText = document.getElementById('editor-trace-text');
    const memoryBox = document.getElementById('editor-memory-grid');

    function assembleAndLoad() {
        try {
            const code = codeArea.value;
            const parsed = TinyISA.assemble(code);
            targetArch = selectArch.value;

            if (targetArch === 'SISD') {
                archInstance = new SISDArchitecture();
            } else if (targetArch === 'SIMD') {
                archInstance = new SIMDArchitecture(4);
            } else {
                archInstance = new MIMDArchitecture(4);
            }

            const customWorkload = {
                id: 'custom_code',
                name: `Custom Program (${targetArch})`,
                description: `Custom user assembly code with ${parsed.instructions.length} instructions.`,
                expectedOutput: null,
                outputAddressBase: 0,
                outputLength: 16,
                initialMemory: new Array(256).fill(0),
                sisdProgram: parsed,
                simdProgram: parsed,
                mimdPrograms: [parsed.instructions, parsed.instructions, parsed.instructions, parsed.instructions]
            };

            archInstance.loadWorkload(customWorkload);

            if (statusBox) {
                statusBox.className = 'status-success';
                statusBox.textContent = `✓ Successfully assembled ${parsed.instructions.length} instructions for ${targetArch}! Ready to step/run.`;
            }
            render();
        } catch (err) {
            if (statusBox) {
                statusBox.className = 'status-error';
                statusBox.textContent = `Assembler Error: ${err.message}`;
            }
        }
    }

    function render() {
        const pe = archInstance.pes[0];
        if (regR0) regR0.textContent = pe.registers.R0;
        if (regR1) regR1.textContent = pe.registers.R1;
        if (regR2) regR2.textContent = pe.registers.R2;
        if (regR3) regR3.textContent = pe.registers.R3;
        if (regPC) regPC.textContent = pe.PC;
        if (regZF) regZF.textContent = pe.ZF;

        if (traceText) traceText.textContent = archInstance.currentTrace || 'Ready.';

        if (memoryBox) {
            let html = '';
            for (let i = 0; i < 48; i++) {
                const val = archInstance.memory.read(i);
                html += `
                    <div class="mem-cell ${val !== 0 ? 'changed' : ''}">
                        <span class="mem-addr">[${i}]</span>
                        <span class="mem-val">${val}</span>
                    </div>
                `;
            }
            memoryBox.innerHTML = html;
        }
    }

    function step() {
        if (!archInstance.isHalted) {
            archInstance.step();
            render();
        } else {
            pause();
        }
    }

    function run() {
        if (isRunning) return;
        isRunning = true;
        if (btnRun) btnRun.innerHTML = '<span>PAUSE</span>';
        clockTimer = setInterval(() => {
            if (!archInstance.isHalted) {
                archInstance.step();
                render();
            } else {
                pause();
            }
        }, 300);
    }

    function pause() {
        isRunning = false;
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        if (btnRun) btnRun.innerHTML = '<span>RUN</span>';
    }

    if (btnAssemble) btnAssemble.addEventListener('click', assembleAndLoad);
    if (btnStep) btnStep.addEventListener('click', step);
    if (btnRun) btnRun.addEventListener('click', () => isRunning ? pause() : run());
    if (btnReset) btnReset.addEventListener('click', assembleAndLoad);

    if (selectArch) {
        selectArch.addEventListener('change', assembleAndLoad);
    }

    assembleAndLoad();
});
