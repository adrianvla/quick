import $ from '../lib/jquery.min.js';
import {showToDo} from "./screens/showToDo.js";
import {showGraph} from "./screens/showGraph.js";
import {showCalendar} from "./screens/showCalendar.js";

export const init = () => {
    showToDo();
    $(".loading").remove();
    $(".btn.tasks").on("click", showToDo);
    $(".btn.graph").on("click", showGraph);
    $(".btn.calendar").on("click",showCalendar);
};