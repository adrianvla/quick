import $ from '../../lib/jquery.min.js';

function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}
function atEnd(arr){
    return arr[arr.length - 1];
}
function withoutLast(arr){
    return arr.slice(0, arr.length - 1);
}
function autocomplete(inp, arr) {
    /*the autocomplete function takes two arguments,
    the text field element and an array of possible autocompleted values:*/
    var currentFocus;
    /*execute a function when someone writes in the text field:*/
    inp.addEventListener("input", function(e) {
        var a, b, i, val = this.value;
        /*close any already open lists of autocompleted values*/
        closeAllLists();
        if (!val) { return false;}
        currentFocus = -1;
        /*create a DIV element that will contain the items (values):*/
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        a.style.position = "absolute";
        let inpPos = inp.getBoundingClientRect();
        a.style.top = inpPos.top - document.querySelector(".modal").getBoundingClientRect().top + 50 + "px";
        a.style.width = inpPos.width + "px";
        a.style.height = inpPos.height + "px";
        /*append the DIV element as a child of the autocomplete container:*/
        this.parentNode.appendChild(a);
        /*for each item in the array...*/
        for (i = 0; i < arr.length; i++) {
            /*check if the item starts with the same letters as the text field value:*/
            if (arr[i].name.substr(0, atEnd(val.split(",")).length).toUpperCase() == atEnd(val.split(",")).toUpperCase()) {
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                b.innerHTML = "<strong>" + arr[i].name.substr(0, atEnd(val.split(",")).length) + "</strong>";
                b.innerHTML += arr[i].name.substr(atEnd(val.split(",")).length);
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += "<input type='hidden' value='" + arr[i].name + "'>";
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    console.log(inp.value.split(","))
                    inp.value = withoutLast(inp.value.split(",")).join(",") + `${inp.value.includes(",") ? "," : ""}${this.getElementsByTagName("input")[0].value},`;

                    //remove duplicates
                    inp.value = [...new Set(inp.value.split(",")).keys()].join(",");

                    //remove first character from inp.value
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    closeAllLists();
                });
                a.appendChild(b);
            }
        }
    });
    /*execute a function presses a key on the keyboard:*/
    inp.addEventListener("keydown", function(e) {
        var x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.keyCode == 40) {
            /*If the arrow DOWN key is pressed,
            increase the currentFocus variable:*/
            currentFocus++;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 38) { //up
            /*If the arrow UP key is pressed,
            decrease the currentFocus variable:*/
            currentFocus--;
            /*and and make the current item more visible:*/
            addActive(x);
        } else if (e.keyCode == 13) {
            /*If the ENTER key is pressed, prevent the form from being submitted,*/
            e.preventDefault();
            if (currentFocus > -1) {
                /*and simulate a click on the "active" item:*/
                if (x) x[currentFocus].click();
            }
        }
    });
    function addActive(x) {
        /*a function to classify an item as "active":*/
        if (!x) return false;
        /*start by removing the "active" class on all items:*/
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        /*add class "autocomplete-active":*/
        x[currentFocus].classList.add("autocomplete-active");
    }
    function removeActive(x) {
        /*a function to remove the "active" class from all autocomplete items:*/
        for (var i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }
    function closeAllLists(elmnt) {
        /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
        var x = document.getElementsByClassName("autocomplete-items");
        for (var i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }
    /*execute a function when someone clicks in the document:*/
    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}
function formatEpoch(epoch) {
    const date = new Date(epoch);

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return [`${day}/${month}/${year}`, `${hours}:${minutes}:${seconds}`];
}
function toEpoch(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);

    // JavaScript Date months are 0-based, so subtract 1 from month
    const date = new Date(year, month - 1, day, hours, minutes, seconds);

    return date.getTime(); // returns epoch in milliseconds
}
export const showModal = (title="Modal", description="Description", btnName="Ok", questionSet=[])=>{
    return new Promise((resolve, reject) => {
        let tl = gsap.timeline();
        tl.fromTo(".modal-c",{
            opacity:0,
        },{
            display:"flex",
            opacity:1,
            duration:0.2,
            pointerEvents:"all"
        })
            .fromTo(".modal",{
                scale:0.8,
            },{
                scale:1,
                duration:0.2,
                pointerEvents:"all"
            },"<");

        $(".modal-c .up").html("<h1></h1><p></p>");
        $(".modal-c h1").text(title);
        $(".modal-c p").text(description);
        $(".modal-c .buttons").html(`<button class="btn primary">${btnName}</button>`);
        const closeModal = () => {
            tl = gsap.timeline();

            tl .fromTo(".modal",{
                scale:1,
            },{
                scale:0.8,
                duration:0.2,
                pointerEvents:"none"
            })
                .fromTo(".modal-c",{
                    opacity:1,
                },{
                    display:"flex",
                    opacity:0,
                    duration:0.2,
                    pointerEvents:"none"
                },"<");
        };
        $(".modal-c").off("click").on("click", (e) => {
            if($(e.target).hasClass("modal-c")){
                closeModal();
                reject();
            }
        });
        // $(".modal-c .up").append(description);
        const toClassName = (str) => {
            return str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        }
        questionSet.forEach(question => {
            if(typeof question === "string"){
                let input = $(`<span class="input-label">${question}</span><input type="text" class="question-input-${toClassName(question)}">`);
                $(".modal-c .up").append(input);
            }else if(question.options){
                let options = $(`<span class="input-label">${question.name}</span><select name="${question.name}" class="question-input-${toClassName(question.name)}">${question.options.map(s => `<option value="${s}" data-color="var(--${s})">${capitalizeFirstLetter(s)}</option>`)}</select>`);
                $(".modal-c .up").append(options);
            }else if(question.autocomplete){
                let input = $(`<span class="input-label">${question.name}</span><input type="text" class="question-input-${toClassName(question.name)}" value="${question.value || ""}">`);
                $(".modal-c .up").append(input);
                autocomplete(document.querySelector(`.question-input-${toClassName(question.name)}`), question.autocomplete);
            }else if(question.type === "date"){
                const dateF = formatEpoch(question.value || Date.now());
                let input = $(`<span class="input-label">${question.name}</span><div class="display:flex;gap:8px"><input type="text" class="question-input-${toClassName(question.name)}" value="${dateF[0] || ""}" style="flex:1;margin-right:5px;"><span> at </span><input type="time" class="question-input-${toClassName(question.name)}2" value="${dateF[1] || ""}" style="flex:1;margin-left:5px;" placeholder="${getCurrentTime()}" step="1"></div>`);
                $(".modal-c .up").append(input);
                const datepicker = new window.Datepicker(input.find(`.question-input-${toClassName(question.name)}`)[0], {format: "dd/mm/yyyy"});
            }else if(question.value !== undefined){
                let input = $(`<span class="input-label">${question.name}</span><input type="text" class="question-input-${toClassName(question.name)}" value="${question.value}">`);
                $(".modal-c .up").append(input);
            }
        });
        $(".modal-c .buttons .btn").on("click", () => {
            closeModal();
            let assembler = {};

            questionSet.forEach(question => {
                if(typeof question === "string") {
                    assembler[question] = $(`.modal-c .up .question-input-${toClassName(question)}`).val();
                }else if(question.options || question.autocomplete){
                    assembler[question.name] = $(`.modal-c .up .question-input-${toClassName(question.name)}`).val();
                }else if(question.type === "date"){
                    assembler[question.name] = toEpoch($(`.modal-c .up .question-input-${toClassName(question.name)}`).val(),$(`.modal-c .up .question-input-${toClassName(question.name)}2`).val());
                }else if(question.value !== undefined){
                    assembler[question.name] = $(`.modal-c .up .question-input-${toClassName(question.name)}`).val();
                }
            });

            resolve(assembler);
        });

    });
};