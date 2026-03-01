## Introduction

Computer Systems: Combination of hardware, software and data that is used to solve problems of human beings.

![Hardware Components.png](https://prod-files-secure.s3.us-west-2.amazonaws.com/82df08a4-f765-4a44-83cb-b29ae7c73e2e/1124044a-623d-4fc3-81be-9d4d3f888f58/Hardware_Components.png)

![Hardware Components (1).png](https://prod-files-secure.s3.us-west-2.amazonaws.com/82df08a4-f765-4a44-83cb-b29ae7c73e2e/4a9045b3-671a-48c0-b867-2dec0bd29054/Hardware_Components_(1).png)

CPU can not directly access the hard disk.

Trivia: All machine code especially that of software are of .exe format.

Since this is the case, consider that the size of the hard disk is enough to hold 500 programs and the RAM has enough space for 50 programs, how would you decide which programs to move into the RAM? 

This can be done by estimating which programs are likely to be used often in the future, however it is difficult to predict the future. We do have certain algorithms that can give us a fairly accurate estimation in this regard. If you consider an Operating System (thinking by first principles) it is essentially a collection of functions. The function responsible for the previously discussed estimation is called a Long Term Scheduler. Long Term Scheduler is a function that implements the selection of processes from Hard Disk to RAM. This is a feature of Operating Systems - Resource Allocation. Eventually all the programs will be able to utilize the resource i.e. RAM, but deciding which process gets first raises the need for these functions and algorithms.

**Note : As of yet the scope of this text is not yet expanded to it’s fullest, henceforth for a brief moment we will use program and process interchangeably.**

Now consider that the 50 programs are there inside the RAM, but our CPU doesn’t have the capacity to execute all at once. In that case which programs will be included first is decided by the algorithms (we will later see these in the CPU Scheduling algorithms). As of now we have to understand that the function (as previously discussed that an OS is a collection of functions) that sends the programs in RAM to the CPU for execution in an algorithmically logical order is called a Short Term Scheduler.

Why is RAM smaller than Hard Disk? Cost of RAM is very large compared to Hard disk. (I’m speculating that this can be attributed to a rather complex nature of RAM as opposed to a static behavior shown by the Hard Disk. But search more about this. RAM is faster and costlier than Hard Disk

To sum up, Operating System is a code that consisting a lot of functions performing the main functionality of Resource Allocation or Resource Management.

![Hardware Components (2).png](https://prod-files-secure.s3.us-west-2.amazonaws.com/82df08a4-f765-4a44-83cb-b29ae7c73e2e/c0fb8433-1eba-4537-a99f-3eb8d95369df/0d4774a6-9600-4227-920e-1170be45704d.png)

So, now we have established that OS is a program acting as a resource manager, let’s get some other concepts clear. Whenever we switch on the computer the OS code is loaded inside the RAM and it will always be present inside the RAM. And the set of addresses in RAM that are occupied by the OS code is called the OS Code Space / OS Space. The remaining space is where the other programs run and is known as the User Space.

### Hardware (I/O) Devices and there interaction with the OS

Every hardware device has a buffer associated with it. Consider an example where you have a keyboard and you are using the calculator app and your goal is to sum 2 and 3 i.e. 2+3=5.

When you enter 2 in the keyboard the buffer stores it in binary 010 and then it is stored in the RAM, when you press 3 after that the buffer overrides 2 and stores 3 in binary 011 and then it is stored in the RAM (binary values). 

This is then sent to the CPU which in turn has a buffer or register. The operands will be fetched/stored in the registers, meaning both the number’s binary value will be stored in the register. Each number will have its own register i.e. 2 numbers 2 register. And the operation will be done by the CPU and the result will be over-written in one of the registers (any register out of the two it depends on the implementation).

Diving into the CPU operation that performs the addition, there are 2 components of the CPU

- The Control Unit (CU) - [will discuss later, the details are out of scope for this text]
- The Arithmetic and Logical Unit (ALU)

ALU can perform all the mathematical operations, this will compute the sum 2+3 and the output 5 101 will be stored in the RAM.

Now this result is to be displayed on the screen hence the result 101 (i.e.) 5 will be placed in the Monitor’s buffer (the Display Screen). Which is then displayed on the screen. 

Consider another small example where you have to make changes or add some text to a word Document, when you open that particular document, the word program is sent in RAM and then the document is also sent to the RAM, the keyboard is used to type in the changes as the keyboard buffer constantly sends the text in appropriate format, the changes are applied to the word and are sent back to the Hard Disk to make the changes permanent. The important thing to note in this example is that the Hard Disk also has a buffer. The final changes are sent to the Hard Disk buffer before they are applied to the Hard Disk. Another peculiar observation is that the Hard Disk can perform both Read and Write operations meaning that it can act as an input as well as an output device, unlike the keyboard which is only an input device.

All the above discussion is intended to make arguments for a point that a program can undergo something called as I/O operation. At some point of time certain programs undergo I/O operations, other times they are either waiting or getting executed in the CPU, this gives rise to the concept of Process States and a new term is introduced i.e. Turn Around Time.  For now we can simply say that Turn around time = Waiting Time + Burst Time + I/O time. 

---

## Process VS Program

### States of a Process

Whenever we start an application or a program, for example let’s consider that we double click Google Chrome, when we double click on the icon the CPU checks if that application is in RAM or not if it is, the CPU starts executing but if it isn’t the program has to be moved from the Hard Disk to the RAM. 

Also whenever you run a program a copy of it is created inside the Hard Disk itself and a single program can have multiple copies, like multiple tabs of Chrome, these copies will be moved into the RAM for further execution. When these copies are made in the Hard Disk we say that the process is in New State. 

Now when the process is moved to the RAM, and it is neither performing I/O (i.e. waiting for CPU time) nor getting executed in the CPU, we say that the process is now in Ready State. Further when the process is getting executed line by line in the CPU, we say that the it is in the Running State.

Before moving on to the next state understand that the CPU only computes with the help of CU and ALU but when it comes to I/O the RAM is majorly involved hence the execution of a process is halted if it has to perform an I/O operation the consequential state is often referred to as the block state or the Waiting state or the I/O state or Blocked State. However due to some complexities we will discuss these states later.

Needless to say that when the process has completed the execution, that state is called the Terminated State. There are 2 more states that we will discuss further, the Suspend Ready State and the Suspend Wait State but before we dive deep into them there are a few concepts of which we should have an understanding. 

### Degree of Multiprogramming

The degree of multiprogramming **describes the maximum number of processes that a single-processor system can accommodate efficiently**. Consider that you have a RAM of 4Gb and the size of each process is 4kb, note that we are assuming that all the processes are of the same size this is not the usual case. So, based on this data we can calculate the degree of programming as:

$$
DoP = Size of Ram/Size of Process

$$

Hence here, DOP = 2^32 B /2^12 B = 2^20 processes 

### Types of Operating System

1. Batch Operating Systems
2. Multiprogramming Operating Systems
3. Multiprocessing Operating Systems

Batch OS - Meaning that the degree of programming is always one, i.e. there will always be only one process in the RAM. This also implies that if the process is in I/O state then there won’t be any other process that would be executing in the meantime since there is none inside the RAM. This decreases the CPU Efficiency which can be calculated as:

$$
CPU Efficiency = Useful Time of CPU/ Total Time of CPU
$$

Multiprogramming OS - In these types of systems the RAM can accommodate more than one processes, this implies that if a process is in the I/O state then there are other processes that can utilize the idle CPU time for their execution thereby increasing the efficiency. Here we see Concurrent Processing in action.

Multiprocessing OS - Here not only the RAM has multiple processes but there are more than one CPUs in the machine which are used simultaneously, it is here that we can see Parallel Processing in action. 

Note: Parallel Processing is faster than Concurrent Processing hence we can say that Multiprocessing is faster than Multiprogramming. But the disadvantage here will be that Multiprocessing Operating Systems will be costlier in comparison due to the involvement of multiple CPUs. 

Trivia: Today’s systems work on Multiprocessing, when you here Octa-core processors as in 8-core processors it means that there are 8 processing units that can function parallelly.

For the purpose of this text we will only be considering Multiprogramming OS i.e. one CPU and multiple processes in the RAM, it will mentioned otherwise if needed.

### Process Control Block and Attributes of a Process

So far we learned that whenever user opens/runs a program a process is created. If for example a user opens a program 3 times then 3 processes are created for the same program. This program, for which the process is created is also called as Passive Entity (because other than creating processes we do not use program for anything else) whereas the process of this program is called Active Entity. 

So now we can define that a program when executed is called a process.

### Process Control Block

But a process will not only contain the program but it will also have stack, heap and data-part. Once we understand further workings of a process we will also understand why this is needed. As we know a program consists a set of function and in these function we have may have function calls, for example f1 calls f2, f2 calls f3 and so on. To keep a log of this each process has a stack. Each function when called is pushed into the stack memory.

Every process has its own PCB, we can also say that every process is nothing but a process control block.

Our program also has something called the dynamic memory allocation, you often heard of malloc() and calloc() in C programming, these functions are used to dynamically allocate memory. Whenever we dynamically allocate memory we use the Heap space. 

The space allocated to heap and stack is not fixed and depends on the process(or program in this case) , some function require more function calls and hence more stack space and sometimes its otherwise meaning some processes require more heap space for dynamic allocation. This is called the Process Control Block. Every process has it’s own process control block. 

Although each function call has its own entry in the stack (Stack Frame in case if you have studied memory management in Rust) but the static and global variables are stored separately in the PCB

![Hardware Components (3).png](https://prod-files-secure.s3.us-west-2.amazonaws.com/82df08a4-f765-4a44-83cb-b29ae7c73e2e/d538308d-8605-4452-91f3-433ec5701f99/Hardware_Components_(3).png)

### Attributes of a Process

1. Process ID: Every process is assigned a number that will uniquely identify that process called Process ID
2. Program Counter: Scheduler is part of the OS program that determines which process in RAM to which the CPU is allocated first. Suppose while executing a process a higher priority process comes in RAM, in that case we would have to preempt the process in CPU in order to execute the higher priority process. Once this is done the initial process will pick up the execution from where it left the last time, a Program Counter will save the instruction number (the line of program from where we stopped the process) from where we have to continue execution. Program counter is nothing but a Register which will be maintained closer to the CPU.  Note that the priority of processes is defined by the scheduling algorithms used by the OS (discussed later).
3. Process States: Discussed Previously
4. General Purpose Register: Resuming our discussion about program counters let’s say we stored certain values that are required throughout the execution of that process, when the process is preempted and then we start execution again from where we left, we will require these values again. These values are stored in the General Purpose Register so that even if the process is removed from the CPU and then called back again the required values will be retained and ready to be accessed at later point in time. For every process we have a set of register values which are to be remembered to accessed later. 
5. Priority: To be discussed later.
6. List of Open Files: Process have certain open files(especially reading some files from the I/O device) that are also to be remembered in order to restart the execution. Let’s say we read a file half way through before preemption we also have to remember where we left off
7. List of Open Devices: Some process may have the use of certain devices for example a printer, suppose we printed half a page before preemption we need to remember where we stopped so that we can resume the process from that point.
8. Protection: For every process we need to make sure that it is not using the space of another process (by space here we refer to the stack and heap space in the PCB and the other parts of PCB too).

### Context of a Process

The Process Control Block (PCB) and attributes of a process is called Context of that process.

Circling back to our introductory discussion about Long Term Scheduler and Short Term Scheduler. LTS selects process that are initiated in the Hard Disk and sends them to RAM, and STS selects the processes in RAM and allots them execution time in the CPU. But consider that a higher priority process is initiated in the Hard Disk and the RAM is full, in that case a lower priority process is sent back to the Hard Disk from RAM to make space for the higher priority process in RAM. This is done by a Medium Term Scheduler. MTS is a function or module in OS code which will decide which process should be swapped out of the RAM so that the high priority process can be swapped in to the RAM.

The moving of the process out of RAM is called Swap-out and moving in is called Swap-in. Entire terminology is called Swapping. Swapping is done by Medium Term Scheduler.

Swapping: 

1. Swap-out
2. Swap-in

Now let’s shift our focus back to CPU, as we discussed previously if a process is getting executed in CPU it will be stopped and moved back to RAM in case a higher priority process comes. Now as we know the context (PCB and attributes) of the preempted process must be stored somewhere so that we can resume from where we left at a later point in time. This context is saved elsewhere and the context of the new process is now considered by the CPU, this switch in context is called Context Switching.

### Times of a Process

Here we will essentially be understanding two major concepts:

1. Point in Time
2. Duration in Time

The times related to a process are:

1. Arrival Time (AT) - Time at which the process is moved from Hard Disk to RAM.
2. Burst Time (aka Execution Time) (BT) - Time spent executing in the CPU by the process.
3. Completion Time (CT) - Time at which the process is completed/terminated.
4. Turn-around Time (TAT) - Total time taken by a process to get executed.
5. Waiting Time (WT) - Time spent waiting in RAM by a process. Process does not undergo I/O here.
6. Response Time - Will discuss later.
7. I/O Time (IOT) - Time taken for I/O by a process.

$$
TAT = CT - AT 

$$

$$
TAT = BT + IOT + WT
$$

in case if I/O time is 0, the equation takes it’s rather familiar form:

$$
TAT = BT + WT
$$

What you have to Understand here is: 

Point in Time: Arrival Time & Completion Time

Duration in Time: Burst Time, Turn-around Time, Waiting Time and Response Time.

## CPU Scheduling Algorithms

There are 2 broad categories for CPU Scheduling Algorithms:

1. Preemptive Scheduling Algorithms
2. Non-Preemptive Scheduling Algorithms

CPU Scheduling algorithms are applied only to processes which are in the Ready State. Processes in I/O state will be blocked and will not be considered by the Scheduling Algorithms while scheduling. This is why in our previous discussion we also referred the I/O state as Blocked State.

We usually calculate TAT and WT but here is a new concept called Schedule Length which means the duration of time from the start of execution of 1st process to the end of execution of last process.

$$
SL = Te-Ts
$$

Another concept is Throughput, meaning number of processes executed per unit time, and can be derived as:

$$
Throughput = Np/SL
$$

where, 

SL = Schedule Length

Np = Number of Processes 

Te = Time at which last process finishes execution

Ts = Time at which first process starts execution

Unit of throughput is processes/unit time

### Shortest Job First (SJF)

Process with the least time burst time will be given preference. It is a priority based non-preemptive algorithm.

### Shortest Remaining Time First

Preemptive form of SJF. After all processes have arrived SRTF will behave like SJF. 

Here we can elaborate on Response Time that we mentioned earlier, Response Time is the duration between the Arrival Time and the time at which the process gets the CPU for the first time.

In any non-preemptive scheduling algorithm Response Time = Waiting Time, but this need not be true for preemptive scheduling algorithms.

[]()

### First Come First Serve (FCFS)

Non-preemptive scheduling algorithm, process with the least arrival time is executed. Note that FCFS is not a priority based scheduling algorithm we are just executing the process that comes first.

### FCFS with Context Switching Overhead

Context Switching Overhead is the time taken to switch the context of the old process to the new process, up until now we assumed it to be 0, but sometimes it will be mentioned that the context switching over head is 1 milli second (say) meaning that it takes 1 milli second for the CPU to switch the context of the processes, say from P1 to P2.

This is where we can also apply the formula we discussed previously, CPU efficiency. Eff=Useful time/total time

If I say it takes 5 msec to execute 5 processes but the context switching overhead is 1 msec, then we can say that the useful time is 5 msec but the total time will be 5 + 5(1 msec per process)=10 msec, hence efficiency will be 5/10 = 0.5 or 50%. 

Context Switching Overhead decreases the efficiency, we can see an inverse proportionality here.

There is another concept called the CPU Inefficiency which is basically the opposite of efficiency: CPU Inefficiency = 100 - CPU Efficiency in percentage. If we consider our previous example, Ineff = 100 - eff = 100 - 50(%) = 50, which is the same as eff in this case but not necessarily same in other cases.

---

# Comparison of FCFS, SJF and SRTF - Advantages and Disadvantages

## Starvation

An algorithm suffers from starvation problem if and only if there is a chance for a process in the ready state to wait indefinitely to get to the CPU. 

There is difference between waiting infinitely and indefinitely,  waiting infinitely for an event to occur means that we are waiting forever, waiting indefinitely for an event to occur means that the event of occurrence is getting postponed continuously, the event can happen but there is not upper bound time for it. 

Note: Any priority based scheduling algorithm will suffer from starvation. There is always a chance that one of it’s process will wait indefinitely. Understand that we are not saying that the process will definitely wait indefinitely but that probability of that happening will never be 0.

A process in SJF has a possibility for starvation, consider that before that process gets CPU other processes with smaller burst time keep coming, in this case our process will never get the chance.

SRTF also suffers from starvation problem. But this is not the case with FCFS, since FCFS is not a priority based algorithm.

## Convoy Effect

A smaller process (in terms of burst time) waiting for a bigger process to release the CPU. An algorithm with Convoy effect problem may lead to higher waiting time and higher TAT in comparison to an algorithm without this problem. FCFS and SJF suffer from this simply because they are non-preemptive algorithms. SRTF will not suffer from this as it preempts the bigger process when a smaller process comes to the RAM.

## Throughput

Practical Implementation: In terms of throughput SJF and SRTF are way better than FCFS but in reality in order to implement SJF and SRTF we have to know the burst time of every process which is very difficult, as opposed to FCFS which is rather straightforward. 

We have discussed this before and if we have to draw analogies we can safely consider that the Throughput is similar to speed.

So for now all we have to understand in terms of throughput is that a FCFS has the least through put and can generate a worst case scenario when, say, the process are arrive in decreasing order of burst time. The SJF algorithm is better than FCFS as it will pick shorter processes first. And finally SRTF will have the highest throughput as it can preempt the bigger process in case a smaller on arrives, something SJF can not do which also sometimes leads to an exact similar Gantt Chart as that of FCFS and consequently the throughput.

---

## Longest Job First (LJF)

Among all the arrived processes the process with the longest burst time will be scheduled first. It is a  non-preemptive priority based scheduling algorithm. Just opposite of SJF.

Disadvantages: Starvation problem and Convoy Effect Problem exists, throughput is low and practically harder to implement(since it is tough to predict the burst times).

## Longest Remaining Time First

Just opposite of SRTF. Among all the processes the one with the longest remaining burst time will be scheduled first. It is a preemptive and priority based scheduling algorithm.

Disadvantages: Starvation problem and Convoy effect problem exists, throughput is low, difficult to implement.

In case if the remaining burst time of two processes is same then the process with least arrival time will be selected. If the arrival time of the processes is also same in that case the processes with the least process no./process id will be selected.

## Round Robin Algorithm

Based on time quantum. Time Quantum: Maximum allowable time a process can run without getting preempted. Round Robin uses Queue data structure. Very popular and used in Microsoft OS today.

Some important observations: As the time quantum increases the number of context switches decreases as this happens the response time also increases. As context switching decreases the overhead time (total overhead time) also decreases.

Advantages of Round Robin: No starvation, no convoy effect problem and practically implementable. Loosely speaking Round Robin is like FCFS but with a time quantum. In addition to this the Response time is also good (as in less).

Limitations: Throughput is good but not as good as SJF and SRTF.

## Priority Based Scheduling Algorithm

Non-preemptive Priority Based Scheduling Algorithm. Priority is given to every process based on which the scheduling is done, it is also mentioned whether it is a high priority scheduling or low priority scheduling. Meaning that whether the processes with higher priority be considered first (high priority scheduling) or the processes with lower priority be scheduled first (low priority scheduling). 

The same thing when done with preemption becomes Preemptive Priority based Scheduling Algorithm, after all the processes have arrived Preemptive Priority Based Algorithm will behave exactly like Non-preemptive Priority Based Algorithm.

## SRTF with Processes Requiring CPU and I/O Time

These types of algorithms are slightly different than the ones we saw up until now. The priority will be considered based on the first burst and when that is over it will be in the blocked state until I/O is done for the I/O time period as specified.

| P. No. | AT | BT (First Burst) | I/O Time  | BT (Second Burst/Final Burst) |
| --- | --- | --- | --- | --- |
| 1 | 0 | 3 | 2 | 2 |
| 2 | 0 | 2 | 4 | 1 |
| 3 | 2 | 1 | 3 | 2 |
| 4 | 5 | 2 | 2 | 1 |

Gantt Chart

| Processes | P2 | P3 | P1 | P1 | P2 | P3 | P3 | P1 | P4 | CPU Idle | P4 |  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Start Time | 0 | 2 | 3 | 5 | 6 | 7 | 8 | 9 | 11 | 13 | 15 | 16 |
| EIOT | 6 | 6 |  | 8 |  |  |  |  |  | 15 |  |  |

EIOT - Expected completion time of I/0

Total Time = 16

CPU Idle Time = 2

Useful CPU Time = 14

CPU Efficiency (in %) = (14/16)*100

## Preemptive Priority Based Scheduling Algorithm with Processes Requiring CPU and I/O Time

[image]

Very similar to above example just using Priority Based Scheduling Algorithm

## Highest Response Ratio Next Scheduling Algorithm

It is a non-preemptive algorithm. SJF’s advantage was a higher throughput but Larger processes sometimes might starve to solve this HRRN use Response Ratio of a process for scheduling. It can be calculated as:

$$
RR = (WT+BT)/BT
$$

WT: Waiting Time

BT: Burst Time

If the WT increases the RR will increase and the process will be scheduled and if the BT is less the process will be scheduled. We are picking up the processes with a lower burst time and higher waiting time.

# Process State Diagram

Process can not go from ready to I/O state, because any I/O device works based on the Control Signals Provided by the CPU

Suspend Ready and Suspend Wait state. If a process is in IO and a high priority process comes along and the RAM is full. In that case the IO process is shifter to Hard Disk but we call this as Suspend Wait State. Note that the process can perform IO even if it is in Hard Disk but it has to be in the CPU at some point in time to initialize the IO.

## Dispatcher

We discussed before that  a Scheduler in OS is a program (or a function in the OS Code) that selects the process to be given to the CPU next. A Dispatcher is also a function in the OS Code, that helps in loading back the data in registers during a context switch. So when a scheduler schedules a process, it calls the Dispatcher to load the registers.

---

# Memory Allocation Techniques

## Basics of Memory Management

We saw various types of memory by now Hard Disk, RAM, Registers and also Cache but Cache is out of scope of our discussion. Apart from that by convention whenever we say memory we mean RAM and by disk we mean Hard Disk.

We discussed a lot about RAM and Hard Disk, let’s talk about register. Registers are the fastest form of memory that work very close to the CPU, they take in “words” from the RAM. The RAM has a lot of “Words” which are memory spaces in RAM that can either store Instructions or Data.

If you reflect with this information for a while there are only two types of things we store in our computers:

1. Instructions
2. Data

Instructions can be interchangeably used with Program, but to understand this completely a Program is collection of Instructions. So, every word in the RAM stores one instruction.

Note: It may take more than one word to store an instruction but, like most textbooks and for our ease of discussion, we will consider that one word stores one instruction.

Every word will have an address starting with 0 and the upper limit depends on the size of the RAM. Now the CPU will always ask for a single word, the CPU will give the address of the word in  the RAM, to the RAM , the RAM will send the copy of contents of the address (word) to the Registers, the CPU will take this data and perform the necessary processes. Now the sending of the request to RAM by CPU and the return of copy of data from RAM to Registers is done by Bus. Bus is nothing but collection of wires, it is used to connect all the devices of our computer. Now this collection contains 3 set of wires two of them are, the one used to send address is called Address Bus, the one use to send data from RAM to Registers is called Data Bus.

Address Space: Collection of addresses, we know that RAM is collection of words which also have addresses, hence we also say that RAM is a collection of addresses, this collection is also called Physical Address Space. The processes are stored in the RAM and the processes also have collection of addresses this is called Logical Address Space.

So set of addresses in memory is called Physical Address Space and set of addresses in a process is called Logical Address Space.

Now, Allocation can be defined as placing of processes inside the RAM, the various methods to load the process to the Main Memory are:

1. Contiguous Allocation
    1. Fixed Partitioning / Static Partitioning: The division of RAM is fixed
        
        Here the RAM(as shown) is divided in to fixed blocks whose size will not change. The following rules are followed in Fixed Partitioning:
        
        | 2 |
        | --- |
        | 1 |
        | 1 |
        | 3 |
        
        RAM
        
        1. A block or a partition can not hold more than one process at a time.
        2. A process can only be stored in one block and can not span across two or more partitions.
        
        This method is one of the oldest methods and is not in use these days because of the following Disadvantages:
        
        1. Internal Fragmentation problem exists: In fixed partitioning each partition of the RAM can only hold 1 process. Meaning if a process of 0.5 MB is stored in a block of 10MB the rest of the 9.5 MB will be unusable.
        2. Here the Degree of Multi programming is equal to the number of Partitions.
        3. Process size is limited by the number of partitions ( like in this case the max process size can be of 3MB).
        
        Note: No external fragmentation problem is seen in Fixed Partitioning.
        
        1. Equal Sized Partitioning: If the size of all partitions are equal (for example 2MB).
        2. Unequal Sized Partitioning: When the sizes of partitions are different.
        
        Both Equal and Unequal Sized Partitioning will suffer from Internal Fragmentation.
        
    2. Variable Partitioning / Dynamic Partitioning: Size of the partition depends on the size of the process.
        
        
        1. No Internal Fragmentation problem is seen
        2. Degree of Multiprogramming is not limited by number of partitions rather it depends on number of processes.
        3. Size of a process is not limited by size of partition rather is limited by the size of the RAM.
        4. Suffers from External Fragmentation: Consider the RAM shown here. Now if process P2 and P4 have completed execution and are removed from the RAM so we are left with two blocks of 2MB each, now if for example a process P6 arrives and it is of 4MB we will not be able to store it in the RAM since the memory is not Contiguous even though the total memory is sufficient for P6. This is not seen in Fixed Partitioning.
        
        In fixed partitioning the space is getting wasted inside the partition and in variable partitioning the space is getting wasted across the partition.
        
        | P1 (1MB) |
        | --- |
        | P2 (2MB) |
        | P3 (6MB) |
        | P4 (2MB) |
        | P5 (1MB) |
        
        RAM
        
2. Non-Contiguous Allocation

## Memory Allocation Algorithms

Hole: Gaps/partitions/blocks in memory that can be allocated. 

Trivia: The memory blocks are stored in the form of a linked-list data structure. The algorithms are:

1. First Fit: Full traversal is not required. The first hole big enough is considered.
2. Next Fit: Full traversal is not required. Same as first fit but saves a pointer to the last selected hole and begins from there for the next process. Restarts again from 0 hole is if not found.
3. Best Fit: We have to compare and traverse all the holes to find the best fit.
4. Worst Fit: Will traverse the entire address space.

Evaluation of the algorithms depends on the use-case, can not properly say that one is better than the other. Sometimes the order in which the process arrive also affects the allocation.

Now, circling back to External Fragmentation there are two was to address this issue:

1. Compaction: After few intervals we will combine the holes together and the allocated spaces together. But the CPU will have to engage in the additional task of copying the processes and place them together, the CPU time is not used efficiently.
2. Paging