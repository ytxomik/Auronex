// Auronex main script

console.log("Auronex loaded");


const cards = document.querySelectorAll(".card");


cards.forEach((card,index)=>{

    card.style.animation =
    `show .8s ${index * 0.2}s both`;

});


// плавный эффект кнопки

const button = document.querySelector("button");


if(button){

button.addEventListener("click",()=>{

    document
    .querySelector(".products")
    .scrollIntoView({
        behavior:"smooth"
    });

});

}
