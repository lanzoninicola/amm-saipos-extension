import "./content-style.css";
import React from 'react';
import ReactDOM from 'react-dom/client';
import AppAssistenteEscolha from "./AppAssistenteEscolha";
import AppSidebar from "./AppSidebar"

console.log("🚀 React content script iniciado");


// const env = process.env.NODE_ENV;

const container = document.createElement("div");
container.id = "amodomio-root";
container.style.position = "fixed";
container.style.top = "0";
container.style.left = "0";
container.style.zIndex = "999999";

document.body.appendChild(container);

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <AppSidebar />
    <AppAssistenteEscolha />
  </React.StrictMode>
);
