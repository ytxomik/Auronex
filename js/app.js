console.log("Auronex v2 loaded");


const buttons = document.querySelectorAll(".main-btn");


buttons.forEach(button => {


    button.addEventListener("mouseenter", ()=>{

        console.log("Hover:", button.innerText);

    });


});
