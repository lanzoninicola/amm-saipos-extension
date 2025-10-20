import { useState } from 'react';
import Draggable from 'react-draggable';

// interface Todo {
//   userId: number;
//   id: number;
//   title: string;
//   completed: boolean;
// }

export default function AppAssistenteEscolha() {

  const [result, setResult] = useState<string>("");

  const fetchDataFromBackground = () => {

    console.log("Fetching data from background script...");

    // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.log("chrome:", chrome);
    // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.log("chrome.runtime:", chrome?.runtime);
    // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.log("chrome.runtime.sendMessage:", chrome?.runtime?.sendMessage);


    // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: "FETCH_ORDER" }, (response) => {

      // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.lastError) {
      if (chrome.runtime.lastError) {
        // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.lastError.message) {
        console.error("Erro ao enviar mensagem para o background script:", chrome.runtime.lastError);
        // @ts-expect-error if (!chrome || !chrome.runtime || !chrome.runtime.lastError.message) {
        setResult("Erro: " + chrome.runtime.lastError.message);
        return;
      }

      if (response?.error) {
        setResult("Erro ao buscar dados: " + response.error);
      } else {
        console.log("Dados recebidos:", response.data);
        setResult(JSON.stringify(response.data, null, 2));
      }
    });
  };


  return (
    <Draggable>
      <div className="w-[100px] h-[100px] bg-red-500 z-[999999] fixed cursor-move">
        {/* conteúdo opcional aqui */}

        <button
          className="bg-blue-500 text-white p-2 rounded"
          onClick={fetchDataFromBackground}
        >
          Buscar Dados
        </button>
        <pre className="text-white">
          {result || "Clique no botão para buscar dados."}
        </pre>
      </div>
    </Draggable>
  );
}

