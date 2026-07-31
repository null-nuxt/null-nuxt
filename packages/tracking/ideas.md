colocar eventos padroes e funcionais caso o dev queira usar como click hover e pageview

o dev conseguir criar novos eventos pra ele usar definindo o nome se precisa de alvo ou n

o evento pode ser dividido em 3 partes
tipo, o avlo que depende do tipo de evento e um slug que seria em si oq seria o evento como add_to_cart por exemplo que o usuario deve registrar quais slugs de eventos existes que tipo é e se o tipo é personalizado o tipo vai ditar se tem target ou n

a nomeclatura vai ser a mais padrao possivel o dev pode escolher como ele vai mandar pro backend mesmo se ele quiser mandar via axios ou com um fetchBuilder do nuxt que ele mesmo fez, alem de ter acesso aos dados que ele vai receber talvez dependendo do evento ou geral conseguir traduzir pra lingua que o backend dele fala

todo o evento deve ter um id que é um uuid que esta conectado com o usuario.

alguns metodos helpers para ele saber ha quanto tempo ele esta no evento atual, qual evento ele ficou mais tempo, ou quantas vezes ele teve tal evento, e separa totalmente de quantas vezes esse evento foi enviado que lembrando que sao coisas diferente, um outro dev pode querer enviar uma vez por pagina o outro por todo evento que acontecer ou ate enviar todos os eventos toda vez que a pagina mudar e etc.

melhorar a forma que registra os eventos  os slugs e etc pq inserir via tracking.d.ts é mt estranho
