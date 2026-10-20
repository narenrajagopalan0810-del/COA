/**
 * FlynnSim - SISD Studio Controller (sisd.html)
 * 
 * Drives the dedicated, spacious SISD uniprocessor simulation view
 * with live disassembly, register files, and data memory inspector.
 */

document.addEventListener('DOMContentLoaded', () => {
    const arch = new SISDArchitecture();
    let currentWorkload = null;
    let isRunning = false;
    let clockTimer = null;
    let clockHz = 4;

    // UI elements
    const selectWorkload = document.getElementById('select-workload');
    const btnStep = document.getElementById('btn-step');
    const btnRun = document.getElementById('btn-run');
    const btnFast = document.getElementById('btn-fast');
    const btnReset = document.getElementById('btn-reset');
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');

    const metricCycles = document.getElementById('metric-cycles');
    const metricInstrs = document.getElementById('metric-instrs');
    const metricUtil = document.getElementById('metric-util');
    const metricIpc = document.getElementById('metric-ipc');
    const statusBadge = document.getElementById('status-badge');

    const traceText = document.getElementById('live-trace-text');
    const schematicContainer = document.getElementById('sisd-schematic-box');
    const disassemblyBox = document.getElementById('disassembly-list');
    const memoryBox = document.getElementById('memory-grid');

    const regR0 = document.getElementById('reg-r0');
    const regR1 = document.getElementById('reg-r1');
    const regR2 = document.getElementById('reg-r2');
    const regR3 = document.getElementById('reg-r3');
    const regPC = document.getElementById('reg-pc');
    const regZF = document.getElementById('reg-zf');
    const regLT = document.getElementById('reg-lt');
    const regGT = document.getElementById('reg-gt');

    function loadWorkload(type) {
        pause();
        if (type === 'vector_addition') {
            currentWorkload = WorkloadManager.createVectorAdditionWorkload(8, 1);
        } else if (type === 'matrix_mult') {
            currentWorkload = WorkloadManager.createMatrixMultiplicationWorkload(2, 1);
        } else if (type === 'conditional_filter') {
            currentWorkload = WorkloadManager.createConditionalFilterWorkload(8, 1);
        } else if (type === 'stream_pipeline') {
            currentWorkload = WorkloadManager.createStreamPipelineWorkload(8);
        }

        arch.loadWorkload(currentWorkload);
        renderDisassembly();
        render();
    }

    function renderDisassembly() {
        if (!disassemblyBox || !arch.program) return;
        const pe = arch.pes[0];
        let html = '';
        arch.program.forEach((instr, idx) => {
            const isActive = pe.PC === idx;
            html += `
                <div class="disassembly-row ${isActive ? 'active-pc' : ''}">
                    <span class="disassembly-pc">${idx.toString().padStart(2, '0')}:</span>
                    <span class="disassembly-code">${instr.raw}</span>
                    ${isActive ? '<span style="margin-left:auto; color:var(--c-instr); font-weight:700;">➔ PC</span>' : ''}
                </div>
            `;
        });
        disassemblyBox.innerHTML = html;
        const activeEl = disassemblyBox.querySelector('.active-pc');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }

    function renderMemory() {
        if (!memoryBox) return;
        let html = '';
        // Display memory locations 0 to 99
        for (let i = 0; i < 96; i++) {
            const val = arch.memory.read(i);
            const isRelevant = (i >= 10 && i < 20) || (i >= 50 && i < 60) || (i >= 90 && i < 100);
            html += `
                <div class="mem-cell ${val !== 0 ? 'changed' : ''}">
                    <span class="mem-addr">[${i}]</span>
                    <span class="mem-val">${val}</span>
                </div>
            `;
        }
        memoryBox.innerHTML = html;
    }

    function render() {
        const pe = arch.pes[0];
        const m = arch.getMetrics(arch.clockCycle);

        // Update telemetry badges
        if (metricCycles) metricCycles.textContent = m.cycles;
        if (metricInstrs) metricInstrs.textContent = m.instructions;
        if (metricUtil) metricUtil.textContent = `${m.utilization}%`;
        if (metricIpc) metricIpc.textContent = m.ipc;

        if (statusBadge) {
            statusBadge.className = `arch-status-badge status-${arch.isHalted ? 'halted' : (arch.clockCycle > 0 ? 'running' : 'idle')}`;
            statusBadge.textContent = arch.isHalted ? 'HALTED' : (arch.clockCycle > 0 ? 'RUNNING' : 'IDLE');
        }

        // Registers
        if (regR0) regR0.textContent = pe.registers.R0;
        if (regR1) regR1.textContent = pe.registers.R1;
        if (regR2) regR2.textContent = pe.registers.R2;
        if (regR3) regR3.textContent = pe.registers.R3;
        if (regPC) regPC.textContent = pe.PC;
        if (regZF) regZF.textContent = pe.ZF;
        if (regLT) regLT.textContent = pe.LT;
        if (regGT) regGT.textContent = pe.GT;

        // Trace text
        if (traceText) traceText.textContent = arch.currentTrace || 'Cycle 0: System ready.';

        // Schematic
        if (schematicContainer) {
            const isExecuting = pe.state === PEState.EXECUTE || pe.state === PEState.MEMORY;
            const currentInstr = pe.currentInstruction ? pe.currentInstruction.raw : (pe.state === PEState.HALTED ? 'HALT' : 'NOP');
            schematicContainer.innerHTML = `
                <div class="arch-schematic sisd-schematic">
                    <div class="legend-bar">
                        <span class="legend-item"><span class="legend-dot dot-instr"></span> 1 Instruction Stream</span>
                        <span class="legend-item"><span class="legend-dot dot-data"></span> 1 Data Stream</span>
                        <span class="legend-item"><span class="legend-dot dot-cu"></span> 1 Control Unit</span>
                    </div>
                    <div class="schematic-flow-row" style="margin-top: 16px;">
                        <div class="hardware-block cu-block ${isExecuting ? 'pulse-amber' : ''}">
                            <div class="block-title">Control Unit (CU)</div>
                            <div class="block-sub">Program Counter: ${pe.PC}</div>
                            <div class="instr-preview">${currentInstr}</div>
                        </div>

                        <div class="stream-connector stream-instruction ${isExecuting ? 'flow-active' : ''}">
                            <div class="stream-line line-instruction"></div>
                            <div class="stream-label">Instruction Stream</div>
                        </div>

                        <div class="hardware-block pe-block state-${pe.state.toLowerCase()}">
                            <div class="block-title">PE 0 (ALU Core)</div>
                            <div class="pe-status-pill ${pe.state.toLowerCase()}">${pe.state}</div>
                            <div class="pe-op-desc" style="font-size:11px; margin-top:4px;">${pe.lastOpDescription}</div>
                        </div>

                        <div class="stream-connector stream-data ${pe.state === PEState.MEMORY ? 'flow-active' : ''}">
                            <div class="stream-line line-data"></div>
                            <div class="stream-label">Data Stream</div>
                        </div>

                        <div class="hardware-block mem-block">
                            <div class="block-title">Data Memory</div>
                            <div class="block-sub">Unified Address Space</div>
                            <div class="mem-preview">[Addr 10..99]</div>
                        </div>
                    </div>
                </div>
            `;
        }

        renderDisassembly();
        renderMemory();
    }

    function step() {
        if (!arch.isHalted) {
            arch.step();
            render();
        } else {
            pause();
        }
    }

    function run() {
        if (isRunning) return;
        isRunning = true;
        updateRunButton();
        clockTimer = setInterval(() => {
            if (!arch.isHalted) {
                arch.step();
                render();
            } else {
                pause();
            }
        }, Math.floor(1000 / clockHz));
    }

    function pause() {
        isRunning = false;
        if (clockTimer) {
            clearInterval(clockTimer);
            clockTimer = null;
        }
        updateRunButton();
    }

    function updateRunButton() {
        if (btnRun) {
            btnRun.innerHTML = isRunning ? '<span>PAUSE</span>' : '<span>RUN</span>';
            btnRun.className = isRunning ? 'control-btn btn-warning' : 'control-btn btn-success';
        }
    }

    function runFast() {
        pause();
        let max = 5000;
        while (!arch.isHalted && max > 0) {
            arch.step();
            max--;
        }
        render();
    }

    // Event listeners
    if (btnStep) btnStep.addEventListener('click', step);
    if (btnRun) btnRun.addEventListener('click', () => isRunning ? pause() : run());
    if (btnFast) btnFast.addEventListener('click', runFast);
    if (btnReset) btnReset.addEventListener('click', () => loadWorkload(selectWorkload.value));

    if (selectWorkload) {
        selectWorkload.addEventListener('change', (e) => loadWorkload(e.target.value));
    }

    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            clockHz = parseInt(e.target.value, 10);
            if (speedValue) speedValue.textContent = `${clockHz} Hz`;
            if (isRunning) {
                pause();
                run();
            }
        });
    }

    // Initialize
    loadWorkload(selectWorkload ? selectWorkload.value : 'vector_addition');
});
