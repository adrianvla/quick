import {randomID} from "../misc/utils.js";

function getDefaults(){
    return [{
        name: "Not Started",
        tasks: [],
        color: "grey"
    },{
        name: "In Progress",
        tasks: [],
        color: "blue"
    },{
        name: "Done",
        tasks: [],
        color: "green"
    }];
}


export const getToDoTasks = () => {
    return JSON.parse(localStorage.getItem('toDoTasks')) || getDefaults();
}
window.getToDoTasks = getToDoTasks;

export const setToDoTasks = (tasks) => {
    localStorage.setItem('toDoTasks', JSON.stringify(tasks));
}

export const removeToDoTasks = () => {
    localStorage.removeItem('toDoTasks');
}
window.removeToDoTasks = removeToDoTasks;


export const createRandomTasks = (num=10)=>{
    let todolist = getToDoTasks();
    for(let i = 0; i < num; i++){
        let cat = Math.floor(Math.random() * todolist.length);
        todolist[cat].tasks.push({
            name: `Task ${i + 1}`,
            description: `This is the description for task ${i + 1}.`,
            id: randomID(),
            requirements: Math.random() < 0.9 ? (()=>{
                let req = [];
                for(let i = 0; i < Math.floor(Math.random() * 5); i++){
                    //find a random task in all categories and add it to the requirements
                    let cat = Math.floor(Math.random() * todolist.length);
                    let task = todolist[cat].tasks[Math.floor(Math.random() * todolist[cat].tasks.length)];
                    if(task)
                    req.push(task.name);
                }
                console.log(req);
                return req;
            })() : [],
            dueDate: new Date(Date.now() + Math.floor(Math.random() * 1000000000)).toISOString(),
            length: Math.floor(Math.random() * 1000000000),
            priority: Math.floor(Math.random() * 3) + 1, // Random priority between 1 and 3
            blocking: [],
        });
    }
    setToDoTasks(todolist);
};
window.createRandomTasks = createRandomTasks;