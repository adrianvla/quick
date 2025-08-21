import $ from '../lib/jquery.min.js';
import {showToDo} from "./screens/showToDo.js";
import {showGraph} from "./screens/showGraph.js";
import {showCalendar} from "./screens/showCalendar.js";
import {showImmediateToDo} from "./screens/showImmediateToDo.js";

export const init = () => {
    showToDo();
    $(".loading").remove();
    $(".btn.tasks").on("click", showToDo);
    $(".btn.graph").on("click", showGraph);
    $(".btn.calendar").on("click",showCalendar);
    $(".btn.immediate-todo").on("click",showImmediateToDo);
};