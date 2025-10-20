

export const linKCardapioText = () => {
    return {
        title: "Link Cardápio",
        content: "Olá!\nVocê pode conferir todas as nossas deliciosas opções de pizzas no link abaixo:\n\nhttps://amodomio.com.br/cardapio\n\nSe tiver alguma dúvida ou precisar de uma recomendação, estou aqui para ajudar! \n\nBuon appetito! 🍕"
    }
}

export const pixText = () => {
    return {
        title: "Pix",
        content: "Chave PIX\n\n*CNPJ* 49850105000129\n*Nome* Gustavo Bergamaschi\n\nPeço a gentileza de enviar o comprovante.\n\nMuito obrigado!"
    }
}

export const pizzaSize = () => {
    return {
        title: "Tamanhos",
        content: "- *INDIVIDUAL*: serve até 1 pessoas, com no máximo um sabor.\n- *MÉDIO* (aprox. 40x20cm ): serve até 2 pessoas, com no máximo dois sabores.\n- *FAMÍLIA* (aprox. 60x40cm): serve até 6 pessoas, com no máximo quatro sabores."
    }
}

export const cortarPizza = () => {
    return {
        title: 'Cortar pizza',
        content: '*Dica boa*: corta a pizza com tesoura! Assim você mantém os ingredientes no lugar, consegue ver direitinho a massa por dentro e ainda facilita na hora de comer.'
    }
}



export const mockDatabase = [
    {
        group: "pre vendas",
        items: [
            linKCardapioText(),
            {
                title: "Como funciona",
                content: "Somos uma pizzaria delivery que oferece uma pizza do estilo romano de Roma, é totalmente diferente das pizzas tradicionais da cidade.\n\nO formato da nossa pizza é retangular, com massa de farinha especial e molho de tomate importado da Itália.\n\nO processo de preparo é italiano, como da tradição, o nosso pizzaiolo è Italiano, nascido e criado em Verona, apaixonado por pizzas.\n\nOs tamanhos disponíveis são:\n\n- *MÉDIO* (40x20cm): serve até 2 pessoas, com no máximo dois sabores.\n- *FAMÍLIA* (60x40cm): serve até 6 pessoas, com no máximo quatro sabores.\n\nOferecemos também a pizza *Al Taglio*, disponível apenas no balcão. São fatias de pizza de 10x20cm, ideais para uma pessoa. Esse último segue um cardápio que muda semanalmente.\n\nNosso hórario de atendimento é *de quarta a domingo, das 18h as 22h*. \n\nSe tiver alguma dúvida ou precisar de uma recomendação, estou aqui para ajudar! \n\nAcesse nosso perfil no Instagram https://www.instagram.com/amodomiopb/ para nos seguir. Você também encontrará fotos das nossas pizzas.\n\nBuon appetito! 🍕"
            },
            {
                title: "Hórario de atendimento",
                content: "Nosso hórario de atendimento é de quarta a domingo, das 18h as 22h."
            },
            {
                title: "Mensagem recebido no fechamento",
                content: "Olá! Agradecemos muito por entrar em contato com nós. Lamentamos não ter respondido antes, pois *estávamos fora do nosso horário de funcionamento*. 😞\n\nAgora estamos abertos e felizes em atender seu pedido! Por favor, nos informe o que você gostaria de pedir ou se há algo em que podemos ajudar.\n\nObrigado por escolher a pizzaria A Modo Mio! ❤️."
            },
            {
                title: "Info restaurante",
                content: "Olá, tudo bem?\n\n*Trabalhamos exclusivamente com delivery*, mas para quem prefere comer no local, temos duas pequenas bancadas externas, ideais para uma refeição rápida. No entanto, a experiência não é como em um restaurante, pois nosso foco principal é a entrega.\n\nSe precisar de algo, estamos à disposição!\n\nObriagdo!"
            },
            pizzaSize(),
            {
                title: "Para fazer um pedido",
                content: ""
            }
        ]
    },
    {
        group: "status de pedidos",
        items: [
            {
                title: "No forno",
                content: "Olá, a sua pizza está no forno."
            },
            {
                title: "Saindo para entrega",
                content: "Seu pedido está a caminho! Obrigado por escolher A Modo Mio!\n\nAmou a pizza? Deixe sua opinião no Google, sua avaliação em 2 min faz toda a diferença! 🙌\n\n👉 https://g.page/r/CceZSxdctFZHEAE/review."
            }
        ]
    },
    {
        group: "post vendas",
        items: [
            cortarPizza(),
            {
                title: "Feedback WhatsApp",
                content: "Agradecemos por ter pedido nossa pizza! Por gentileza, nos envie um feedback aqui pelo WhatsApp sobre como foi a sua experiência."
            },
            {
                title: "Feedback Google",
                content: "Se você gostou da nossa pizza e quer apoiar nosso crescimento, por que não deixar um comentário no Google pelo link https://g.page/r/CceZSxdctFZHEAE/review? São 2 minutos que, para nós, faz toda a diferença."
            },

            pixText()
        ]
    },
    {
        group: "RH",
        items: [
            {
                title: "Assistente Cozinha - Vaga aberta",
                content: "Olá! Asgradecemos pelo interesse na vaga de Assistente de Cozinha na pizzaria A Modo Mio.\n\nVocê pode obter mais informações e se candidatar através da página\n\nhttps://www.amodomio.com.br/vagas/auxiliar-cozinha. \n\nAgradecemos novamente pelo interesse e esperamos contar com você em breve.\n\nEquipe A Modo Mio"
            },
            {
                title: "Assistente Cozinha - Vaga fechada",
                content: "Olá! Agradecemos pelo interesse na vaga de Assistente de Cozinha na pizzaria A Modo Mio. Informamos que, no momento, a vaga está fechada.\n\nConvidamos você a se candidatar através da página https://www.amodomio.com.br/vagas/auxiliar-cozinha em qualquer caso.\n\nSuas informações serão mantidas caso abrirmos novamente a mesma ou novas vagas.\n\nAgradecemos novamente pelo interesse e esperamos contar com você em breve.\n\n"
            }
        ]
    }
]