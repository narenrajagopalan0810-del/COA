# FLYNNSIM: Computer Organisation & Architecture Simulator
### Michael J. Flynn's Taxonomy (SISD, SIMD, MISD, MIMD) & Cycle-Accurate Microarchitecture Visualizer

```
====================================================================================================
SYSTEM: FLYNNSIM ARCHITECTURE LAB    // STATUS: PRODUCTION [ONLINE]   // CLOCK: 4.00 HZ [CYCLE-SYNC]
CORE TAXONOMY: SISD | SIMD | MISD | MIMD                             // VERIFICATION: 100% (5/5 PASS)
USER INTERFACE: CRT MAINFRAME TERMINAL (v20261016_v3)                // SUB-PAGES: 8 DEDICATED STUDIOS
====================================================================================================
```

---

## 1. Project Overview

**FlynnSim** is an open-source, cycle-accurate computer architecture simulation and research platform. It provides an interactive microarchitectural environment for exploring **Michael J. Flynn's 1966 taxonomy** of computer architectures:

1. **[01] SISD** - Single Instruction, Single Data (Von Neumann Uniprocessors)
2. **[02] SIMD** - Single Instruction, Multiple Data (Vector Processing Units & GPU Warps)
3. **[03] MISD** - Multiple Instruction, Single Data (Systolic DSP Pipelines & Fault-Tolerant TMR Voting)
4. **[04] MIMD** - Multiple Instruction, Multiple Data (Shared-Memory Multicores & Distributed Clusters)

While conventional computer architecture curricula rely on static 2x2 matrix diagrams, **FlynnSim models hardware execution at the discrete clock-cycle level**. Students observe instruction fetch, decode, execute, memory access, bus arbitration, predication mask serialization, and register state transitions in real time.

---

## 2. Key Architectural Features

### Synchronous Multi-Architecture Race Arena
- Execute identical computational workloads simultaneously across SISD, SIMD, MISD, and MIMD.
- Synchronous clock stepping exposes cycle count disparities, instruction throughput, speedup gains, and processing element (PE) utilization in real time.

### Cycle-Accurate Microarchitecture Engine
- **TinyISA**: Custom 16-opcode instruction set with native control flow, arithmetic, memory access, and vector predication.
- **Latency-Accurate Hardware Timing**:
  - ALU Operations (`ADD`, `SUB`, `CMP`, `NOP`): **1 Cycle**
  - Multiplication (`MUL`): **2 Cycles**
  - Memory Bus Access (`LOAD`, `STORE`): **2 Cycles** (Address generation + Bus transfer)
  - Control Flow (`JMP`, `BEQ`, `BNE`, `BLT`, `BGT`): **1 Cycle**
  - Vector Predication (`MASK_EVAL`, `MASK_INVERT`, `MASK_RESET`): **1 Cycle**
  - Core Termination (`HALT`): **1 Cycle**
- **Discrete Processing Elements (PEs)**: Each processing element contains independent registers (`R0` through `R3`), a Program Counter (`PC`), condition flags (`ZF`, `LT`, `GT`), and an active predication mask (`MASK`).

### Concrete Architectural Paradigms

| Architecture | Control Units (CU) | Processing Elements (PE) | Memory Topology | Real-World Hardware Parallel |
| :--- | :--- | :--- | :--- | :--- |
| **SISD** | 1 Central CU | 1 Uniprocessor PE | Single unified memory bus | Intel 8086, ARM Cortex-M0 |
| **SIMD** | 1 Master CU | N Lockstep PEs (2-16) | Broadcast bus + Predication | SSE/AVX vector units, NVIDIA GPU warps |
| **MISD** | N Autonomous CUs | N Specialized PEs | Streaming pipe / Broadcast sensor | Systolic matrix arrays, Space Shuttle AP-101 TMR |
| **MIMD** | N Autonomous CUs | N Independent PEs | Shared bus (SMP) or Cluster (NUMA) | Multi-core x86/ARM, Supercomputing clusters |

### Mathematically Verified Workloads
- **Vector Addition**: C[i] = A[i] + B[i] with automated handling of non-divisible array lengths (e.g., L = 7, N = 4) via tail-mask predication.
- **Matrix Multiplication**: Full 2 x 2 matrix dot-product equivalence verified against reference models.
- **Conditional Filter**: `if (A[i] > 10) A[i] * 2 else A[i] + 5` demonstrating the SIMD branch divergence penalty (serialization of `THEN` and `ELSE` blocks) compared to asynchronous MIMD branching.
- **Fault-Tolerant Voting (TMR)**: Triple Modular Redundancy with real-time fault injection on PE 1, demonstrating majority-rule fault masking via a 2-out-of-3 voting unit.

### Analytical Telemetry & Theoretical Models
- **Real-Time Performance Metrics**: Total Clock Cycles (T), Instructions Executed (I), Speedup (S = T_SISD / T), Hardware Efficiency (E = S / N), Processing Element Utilization (%), and Instructions Per Cycle (IPC).
- **Interactive Amdahl's Law Scaling Lab**: Dynamic parallel fraction slider (p from 0.0 to 1.0) demonstrating theoretical asymptotic limits against empirical SIMD/MIMD measurements:
  $$S(N) = \frac{1}{(1 - p) + \frac{p}{N}}$$
- **One-Click CSV Export**: Download complete benchmark telemetry and cycle-by-cycle trace logs for lab reports and research.

---

## 3. Dedicated Modular Sub-Pages Directory

To avoid cluttered single-page interfaces, FlynnSim organizes each architectural process and analytical tool into dedicated, spacious sub-pages:

```
=============================================================================================
SUB-PAGE ROUTE      PURPOSE & CAPABILITIES
=============================================================================================
[00] index.html     Hero Architecture Hub: Flynn's classification overview, live hardware
                    telemetry strip (SYS_ONLINE // 4.00 HZ), 4 interactive architectural
                    quadrant cards ([01] to [04]), and quick-action navigation.
---------------------------------------------------------------------------------------------
[01] sisd.html      SISD Studio: Dedicated Von Neumann uniprocessor workbench with live
                    disassembled instruction pointer tracking, register inspection, and
                    unified memory cell visualization.
---------------------------------------------------------------------------------------------
[02] simd.html      SIMD Studio: Vector architecture workbench with master instruction
                    broadcasting to N lockstep PEs, vector predication masking, and an
                    integrated GPU branch divergence stall meter.
---------------------------------------------------------------------------------------------
[03] misd.html      MISD Studio: Dual-paradigm exploration featuring a systolic stream
                    pipeline and a Space Shuttle Triple Modular Redundancy (TMR) engine
                    with interactive runtime fault injection and majority voting.
---------------------------------------------------------------------------------------------
[04] mimd.html      MIMD Studio: Multi-core architecture workbench supporting both Shared
                    Memory (SMP/UMA) with Round-Robin bus contention arbitration and
                    Distributed Memory (Cluster/NUMA) with partitioned address spaces.
---------------------------------------------------------------------------------------------
[05] analytics.html Performance Analytics & Amdahl's Law Lab: Multi-architecture comparative
                    metrics tables, cycle/speedup bar charts, dynamic Amdahl's Law scaling
                    curves with adjustable parallel fraction (p), and CSV telemetry export.
---------------------------------------------------------------------------------------------
[06] theory.html    Theory Compendium & Viva Defense Guide: Detailed architectural essays,
                    formal mathematical derivations, Flynn's 2x2 matrix analysis, and
                    20+ curated university examination viva questions with model answers.
---------------------------------------------------------------------------------------------
[07] editor.html    TinyISA Assembly IDE & Debugger: Integrated assembly code editor,
                    two-pass assembler, syntax error validator, and cycle-by-cycle debugger
                    with target hardware selection (SISD, SIMD, MIMD).
=============================================================================================
```

---

## 4. Frontend & User Interface Architecture

The FlynnSim interface has been completely redesigned following an authentic **CRT Mainframe Terminal** aesthetic:

- **Monochrome Dark Palette**: High-contrast pitch black base (`#000000` / `#020502` / `#050c06`), bright phosphor green accents (`#00ff41` / `#39ff14`), and soft mint green readable typography (`#86efac`).
- **Fixed Left Navigation Sidebar**: Permanent 280px left sidebar fixed to the viewport on every sub-page, categorised into `// PROCESSING ENGINES` (`[01]` through `[04]`) and `// ARENA & EXPERIMENTS` (`[00]`, `[05]`, `[06]`, `[07]`).
- **Smooth Transition Effects**: Hover transformations featuring rightward slide translation (`translateX(6px)`), color inversion to black text on phosphor green, and outer glow box-shadows.
- **Clean Terminal Controls**: Clean, bracketed monospaced action buttons (`[ STEP CYCLE ]`, `[ RUN ]`, `[ RUN TO HALT ]`, `[ RESET ]`) with zero icons and zero emojis.
- **Resilient Layout System**: Embedded fallback terminal styles and versioned cache-busting links (`style.css?v=20261016_v3`) across all 8 HTML heads, guaranteeing perfect rendering regardless of browser cache status.

---

## 5. Microarchitecture Specifications & TinyISA Reference

Each Processing Element (PE) operates an internal 4-register file plus special-purpose status and control registers:

```
+-----------------------------------------------------------------------------+
|                        PROCESSING ELEMENT (PE) REGISTERS                    |
+---------+--------------------+----------------------------------------------+
| NAME    | WIDTH              | FUNCTION / PURPOSE                           |
+---------+--------------------+----------------------------------------------+
| R0      | 16-bit General     | Primary accumulator & ALU operand register   |
| R1      | 16-bit General     | Secondary operand register                   |
| R2      | 16-bit General     | Memory address pointer / indexing register   |
| R3      | 16-bit General     | Scratchpad / loop counter register           |
| PC      | 16-bit Control     | Program Counter (Address of next instruction)|
| ZF      | 1-bit Flag         | Zero Flag (Set if ALU result == 0)           |
| LT      | 1-bit Flag         | Less-Than Flag (Set if R0 < operand)         |
| GT      | 1-bit Flag         | Greater-Than Flag (Set if R0 > operand)      |
| MASK    | 1-bit Vector Mask  | Predication flag (1 = Active, 0 = Inactive)  |
+---------+--------------------+----------------------------------------------+
```

### Instruction Set Architecture (TinyISA)

| Opcode | Operands | Cycles | Description | Example |
| :--- | :--- | :---: | :--- | :--- |
| `LOAD` | `Rd, [addr]` | 2 | Load 16-bit word from memory address into register | `LOAD R0, [16]` |
| `STORE` | `Rs, [addr]` | 2 | Store 16-bit word from register into memory address | `STORE R0, [32]` |
| `ADD` | `Rd, Rs/imm` | 1 | Add register or immediate to destination register | `ADD R0, R1` |
| `SUB` | `Rd, Rs/imm` | 1 | Subtract operand from destination register | `SUB R0, 1` |
| `MUL` | `Rd, Rs/imm` | 2 | Multiply destination register by operand | `MUL R0, 2` |
| `CMP` | `Rd, Rs/imm` | 1 | Compare register against operand; update ZF, LT, GT | `CMP R0, 10` |
| `JMP` | `target` | 1 | Unconditional jump to label or instruction index | `JMP 4` |
| `BEQ` | `target` | 1 | Branch to target if Zero Flag (ZF) == 1 | `BEQ 8` |
| `BNE` | `target` | 1 | Branch to target if Zero Flag (ZF) == 0 | `BNE 12` |
| `BLT` | `target` | 1 | Branch to target if Less-Than Flag (LT) == 1 | `BLT loop` |
| `BGT` | `target` | 1 | Branch to target if Greater-Than Flag (GT) == 1 | `BGT exit` |
| `MASK_EVAL` | `cond` | 1 | Evaluate flag condition into PE active predication mask | `MASK_EVAL GT` |
| `MASK_INVERT`| - | 1 | Invert predication mask (enables alternate branch path) | `MASK_INVERT` |
| `MASK_RESET` | - | 1 | Reset all PE predication masks to active state (`1`) | `MASK_RESET` |
| `NOP` | - | 1 | No operation (pipeline bubble / alignment) | `NOP` |
| `HALT` | - | 1 | Terminate processing element execution | `HALT` |

---

## 6. Repository File Structure

```
COA Project/
|-- index.html                 # [00] Architecture Hub & Hero Dashboard
|-- sisd.html                  # [01] Dedicated SISD Uniprocessor Studio
|-- simd.html                  # [02] Dedicated SIMD Vector & GPU Studio
|-- misd.html                  # [03] Dedicated MISD Stream & TMR Voting Studio
|-- mimd.html                  # [04] Dedicated MIMD Multiprocessor Studio
|-- analytics.html             # [05] Performance Analytics & Amdahl's Law Lab
|-- theory.html                # [06] Computer Architecture Theory & Viva Guide
|-- editor.html                # [07] TinyISA Assembly IDE & Core Debugger
|-- css/
|   |-- style.css              # Mainframe terminal design system & typography
|-- js/
|   |-- isa.js                 # TinyISA opcodes, cycle latencies & two-pass assembler
|   |-- pe.js                  # Processing Element model, registers & ALU logic
|   |-- memory.js              # Address space & Round-Robin bus contention arbiter
|   |-- architectures/
|   |   |-- base_arch.js       # Abstract base class for all simulated architectures
|   |   |-- sisd.js            # SISD uniprocessor execution engine
|   |   |-- simd.js            # SIMD vector broadcasting & predication engine
|   |   |-- misd.js            # MISD systolic pipeline & TMR voting engine
|   |   |-- mimd.js            # MIMD multicore & bus contention engine
|   |-- workloads.js           # Workload generators & ground truth reference models
|   |-- simulation.js          # Master clock & multi-architecture race coordinator
|   |-- visualizer.js          # Live interactive microarchitecture schematics
|   |-- charts.js              # Chart.js analytics engine & CSV exporter
|   |-- app.js                 # Race arena controller & event bindings
|   |-- page_sisd.js           # SISD Studio controller & disassembly inspector
|   |-- page_simd.js           # SIMD Studio controller & divergence meter
|   |-- page_misd.js           # MISD Studio controller & TMR fault injector
|   |-- page_mimd.js           # MIMD Studio controller & bus contention telemetry
|   |-- page_analytics.js      # Analytics Lab controller & Amdahl scaling slider
|   |-- page_editor.js         # Assembly IDE controller, assembler & step debugger
|-- tests/
|   |-- test_cases.js          # Mathematical equivalence & architecture test suite
|   |-- verify_pages.js        # HTTP server & layout verification test suite
|-- README.md                  # Comprehensive technical documentation & setup guide
|-- REPORT.md                  # Academic report outline & viva reference manual
```

---

## 7. How to Run FlynnSim

### Option 1: Direct File Launch (No Dependencies Required)
FlynnSim is developed using standard Vanilla JavaScript, HTML5, and CSS3 without npm dependencies or bundlers:
1. Double-click `index.html` or open it in any modern browser (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
2. The complete terminal simulation suite will run locally.

### Option 2: Local HTTP Server (Recommended)
Running via a local HTTP server ensures optimal performance and CDN asset availability:

```powershell
# Using Python 3:
python -m http.server 8000

# Or using Node.js:
npx serve . -p 8000
```

Open your browser to: `http://localhost:8000/index.html`

---

## 8. Automated Verification & Testing

FlynnSim includes automated verification suites for both architectural correctness and UI integrity.

### 1. Architectural Verification Suite
Run the mathematical equivalence and microarchitectural unit test suite:

```powershell
node tests/test_cases.js
```

**Test Suite Verification Results:**

```
==========================================================
       FlynnSim Architecture Verification Test Suite      
==========================================================

TEST 1: Vector Addition Equivalence (L = 8, N = 4)
  [OK] Expected Ground Truth: [8, 16, 24, 32, 40, 48, 56, 64]
  [OK] SISD (81 cycles):      [8, 16, 24, 32, 40, 48, 56, 64]
  [OK] SIMD (24 cycles):      [8, 16, 24, 32, 40, 48, 56, 64]
  [OK] MIMD (38 cycles):      [8, 16, 24, 32, 40, 48, 56, 64]
  [OK] Speedup SIMD: 3.38x | Speedup MIMD: 2.13x
  >>> TEST 1 PASSED!

TEST 2: Edge Case: Non-Divisible Vector Length (L = 7, N = 4)
  [OK] Handled 7 elements across 4 PEs (Chunk 1: 4 PEs, Chunk 2: 3 PEs active, 1 masked)
  [OK] SIMD Tail-Mask Output: [8, 16, 24, 32, 40, 48, 56] equals reference
  >>> TEST 2 PASSED!

TEST 3: Matrix Multiplication 2x2 Mathematical Equivalence
  [OK] Matrix A = [[1, 2], [3, 4]], B = [[2, 3], [4, 5]]
  [OK] Result Product C: [10, 13, 22, 29] matches reference
  >>> TEST 3 PASSED!

TEST 4: Conditional Filter Branch Divergence Verification
  [OK] Conditional Outputs match: [9, 30, 13, 44, 22, 8, 36, 14]
  [OK] SIMD Divergence Stalls accurately recorded: 40 PE-cycles spent masked off
  >>> TEST 4 PASSED!

TEST 5: MISD Fault-Tolerant Voting (TMR) Fault Masking
  [OK] Fault injected on PE 1: Corrupted data successfully masked by 2-out-of-3 Voter!
  [OK] Verified Output Memory: [40, 66, 94, 130, 160, 190] equals Ground Truth
  >>> TEST 5 PASSED!

==========================================================
 TEST SUMMARY: 5/5 TESTS PASSED (100% SUCCESS)
==========================================================
```

### 2. Multi-Page HTTP & CSS Verification Suite
Validate that all 8 sub-pages serve with HTTP 200, embedded resilient styles, and cache-busting:

```powershell
node tests/verify_pages.js
```

**Page Verification Results:**
```
[PASS] index.html       -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] sisd.html        -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] simd.html        -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] misd.html        -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] mimd.html        -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] analytics.html   -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] theory.html      -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
[PASS] editor.html      -> HTTP 200 | FixedSidebarCSS: true | CacheBusterCSS: true
```

---

## 9. Viva & Demonstration Walkthrough

When presenting FlynnSim for project evaluations, viva examinations, or lab demonstrations, follow this structured five-step walkthrough:

### Step 1: Synchronous Multi-Architecture Race Demonstration
1. Navigate to **[00] Race Arena** (`index.html`).
2. Select **Vector Addition (L = 8)** from the workload dropdown.
3. Click **[ STEP CYCLE ]** 2-3 times: Explain how control units fetch instructions from memory and point out instruction fetch telemetry in the active registers.
4. Click **[ RUN TO HALT ]**: Observe execution completion:
   - **SISD**: Finishes in **81 cycles** (sequential loop overhead).
   - **MIMD**: Finishes in **38 cycles** (2.13x speedup, showing slight contention overhead).
   - **SIMD**: Finishes in **24 cycles** (3.38x speedup, showing high lockstep efficiency).
5. Highlight the **Verification Banner**: Demonstrates that all architectures computed identical results matching the mathematical ground truth.

### Step 2: SIMD Branch Divergence & Mask Predication
1. Navigate to **[02] SIMD Studio** (`simd.html`).
2. Select **Conditional Filter (SIMD Divergence Demo)**.
3. Click **[ RUN TO HALT ]**.
4. Show the **Divergence Penalty Meter**: Hardware utilization drops to ~50% because the single instruction sequencer must serialize both the `THEN` and `ELSE` execution paths. PEs evaluating false are masked off (`MASK=0`) and sit idle.
5. Contrast this with **[04] MIMD Studio** (`mimd.html`), where independent cores execute divergent branches asynchronously without stalling peer cores.

### Step 3: MISD Real-World Space Shuttle TMR Voting
1. Navigate to **[03] MISD Studio** (`misd.html`).
2. Select the **Triple Modular Redundancy (TMR) Model**.
3. Click **[ INJECT FAULT ON PE 1 ]**.
4. Click **[ RUN TO HALT ]**: Observe that PE 1 computes a corrupted data value, but the **2-out-of-3 Hardware Voter** intercepts the corrupted output, identifies the anomaly, and writes the correct consensus value into memory.

### Step 4: Shared Memory Bus Contention in MIMD
1. Navigate to **[04] MIMD Studio** (`mimd.html`).
2. Toggle between **Shared Memory (SMP/UMA)** and **Distributed Memory (Cluster)**.
3. Execute the memory-heavy vector addition workload and observe the **Round-Robin Bus Arbiter**: Show how simultaneous `LOAD` and `STORE` requests introduce bus contention wait cycles in shared-memory mode, whereas distributed memory avoids bus stalls at the cost of requiring explicit message passing.

### Step 5: Amdahl's Law Scaling & Assembly IDE Debugging
1. Navigate to **[05] Analytics & Amdahl's Law Lab** (`analytics.html`).
2. Drag the **Parallel Fraction (p)** slider from 0.95 down to 0.60: Show that when 40% of code is serial, theoretical speedup can never exceed 2.5x, even with infinite cores.
3. Navigate to **[07] TinyISA Assembly IDE** (`editor.html`).
4. Type or load an assembly program, click **[ ASSEMBLE & LOAD ]**, and single-step through execution while observing register state mutations.

---

## 10. Theoretical Formulas & Performance Metrics

FlynnSim calculates the following performance metrics dynamically at runtime:

- **Speedup (S)**:
  $$S = \frac{T_{SISD}}{T_{parallel}}$$
  Measures the relative execution speed advantage of a parallel architecture over the uniprocessor baseline.

- **Hardware Efficiency (E)**:
  $$E = \frac{S}{N} = \frac{T_{SISD}}{N \times T_{parallel}}$$
  Measures how effectively the available processing elements (N) are utilized. Ideal linear speedup yields E = 1.0 (100%).

- **Processing Element Utilization (U)**:
  $$U = \frac{\sum_{i=1}^N \text{Active PE Cycles}}{N \times T_{total}} \times 100\%$$
  Reflects the percentage of total available processor-cycles spent executing real instructions versus idling or masked out during branch divergence.

- **Instructions Per Cycle (IPC)**:
  $$\text{IPC} = \frac{\text{Total Instructions Executed}}{T_{total}}$$

- **Amdahl's Law Strong Scaling Limit**:
  $$S_{max}(N, p) = \frac{1}{(1 - p) + \frac{p}{N}}$$
  Where p represents the parallelizable portion of the workload and N represents the core count. As N -> infinity, S_max -> 1 / (1 - p).

---

## 11. Authors & Academic Acknowledgments

- **Project**: FlynnSim - Computer Systems Architecture Simulator
- **Focus**: Michael J. Flynn's Taxonomy (1966) & Cycle-Accurate Microarchitecture Visualizer
- **Domain**: Advanced Computer Systems Architecture & Parallel Computing
- **License**: Open-Source / Academic & Industry Research Use
