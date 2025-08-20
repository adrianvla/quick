import $ from '../../lib/jquery.min.js';

export const showScreen = (screen) => {
    document.querySelectorAll('[data-screen]').forEach(el => {
        let displayIn = $(el).attr("data-screen").split(",");
        if(displayIn.includes(screen)) $(el).show();
        else $(el).hide();
    });
};