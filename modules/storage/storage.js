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