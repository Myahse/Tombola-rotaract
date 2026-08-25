export type SeedChoice = { id: string; textFr: string; textEn: string };

export type SeedQuestion = {
  promptFr: string;
  promptEn: string;
  choices: SeedChoice[];
  correctChoiceId: string;
};

export const INDUCTION_QUESTIONS: SeedQuestion[] = [
  {
    promptFr: "Que signifie Rotaract ?",
    promptEn: "What does Rotaract stand for?",
    choices: [
      { id: "a", textFr: "Rotary in Action", textEn: "Rotary in Action" },
      { id: "b", textFr: "Rotation et action", textEn: "Rotation and action" },
      { id: "c", textFr: "Royal Trade Action", textEn: "Royal Trade Action" },
      { id: "d", textFr: "Road to Action", textEn: "Road to Action" },
    ],
    correctChoiceId: "a",
  },
  {
    promptFr: "Quelle est la devise officielle de Rotary ?",
    promptEn: "What is Rotary’s official motto?",
    choices: [
      { id: "a", textFr: "Unis pour servir", textEn: "United to serve" },
      { id: "b", textFr: "Service Above Self", textEn: "Service Above Self" },
      { id: "c", textFr: "Toujours plus haut", textEn: "Ever higher" },
      { id: "d", textFr: "Agir localement", textEn: "Act locally" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quelle est la première question du Test des 4 questions ?",
    promptEn: "What is the first question of The Four-Way Test?",
    choices: [
      { id: "a", textFr: "Est-ce équitable pour tous ?", textEn: "Is it fair to all concerned?" },
      { id: "b", textFr: "Est-ce la vérité ?", textEn: "Is it the truth?" },
      { id: "c", textFr: "Est-ce bénéfique pour tous ?", textEn: "Will it be beneficial to all concerned?" },
      { id: "d", textFr: "Cela renforcera-t-il l’amitié ?", textEn: "Will it build goodwill and better friendships?" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "En quelle année Rotary a-t-il été fondé ?",
    promptEn: "In which year was Rotary founded?",
    choices: [
      { id: "a", textFr: "1905", textEn: "1905" },
      { id: "b", textFr: "1917", textEn: "1917" },
      { id: "c", textFr: "1945", textEn: "1945" },
      { id: "d", textFr: "1968", textEn: "1968" },
    ],
    correctChoiceId: "a",
  },
  {
    promptFr: "Qui a fondé Rotary ?",
    promptEn: "Who founded Rotary?",
    choices: [
      { id: "a", textFr: "Jean Monnet", textEn: "Jean Monnet" },
      { id: "b", textFr: "Paul Harris", textEn: "Paul Harris" },
      { id: "c", textFr: "Herbert Hoover", textEn: "Herbert Hoover" },
      { id: "d", textFr: "Arch Klumph", textEn: "Arch Klumph" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quelle est la tranche d’âge habituelle des membres Rotaract ?",
    promptEn: "What is the usual age range for Rotaract members?",
    choices: [
      { id: "a", textFr: "12 à 18 ans", textEn: "12 to 18" },
      { id: "b", textFr: "18 à 30 ans", textEn: "18 to 30" },
      { id: "c", textFr: "25 à 50 ans", textEn: "25 to 50" },
      { id: "d", textFr: "Aucun âge limite", textEn: "No age range" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Où se trouve le siège de Rotary International ?",
    promptEn: "Where is Rotary International headquartered?",
    choices: [
      { id: "a", textFr: "Chicago, Illinois", textEn: "Chicago, Illinois" },
      { id: "b", textFr: "Genève, Suisse", textEn: "Geneva, Switzerland" },
      { id: "c", textFr: "Evanston, Illinois", textEn: "Evanston, Illinois" },
      { id: "d", textFr: "New York, New York", textEn: "New York, New York" },
    ],
    correctChoiceId: "c",
  },
  {
    promptFr: "Rotaract est un programme de :",
    promptEn: "Rotaract is a program of:",
    choices: [
      { id: "a", textFr: "l’ONU", textEn: "the United Nations" },
      { id: "b", textFr: "Rotary International", textEn: "Rotary International" },
      { id: "c", textFr: "l’UNESCO", textEn: "UNESCO" },
      { id: "d", textFr: "la Croix-Rouge", textEn: "the Red Cross" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quelles sont les couleurs officielles de Rotary ?",
    promptEn: "What are Rotary’s official colors?",
    choices: [
      { id: "a", textFr: "Rouge et blanc", textEn: "Red and white" },
      { id: "b", textFr: "Vert et or", textEn: "Green and gold" },
      { id: "c", textFr: "Bleu royal et or", textEn: "Royal blue and gold" },
      { id: "d", textFr: "Noir et argent", textEn: "Black and silver" },
    ],
    correctChoiceId: "c",
  },
  {
    promptFr: "Combien d’avenues du service Rotary compte-t-on ?",
    promptEn: "How many Avenues of Service does Rotary have?",
    choices: [
      { id: "a", textFr: "Deux", textEn: "Two" },
      { id: "b", textFr: "Trois", textEn: "Three" },
      { id: "c", textFr: "Quatre", textEn: "Four" },
      { id: "d", textFr: "Cinq", textEn: "Five" },
    ],
    correctChoiceId: "d",
  },
  {
    promptFr: "Dans quelle ville le premier club Rotary a-t-il été fondé ?",
    promptEn: "In which city was the first Rotary club founded?",
    choices: [
      { id: "a", textFr: "New York", textEn: "New York" },
      { id: "b", textFr: "Chicago", textEn: "Chicago" },
      { id: "c", textFr: "Londres", textEn: "London" },
      { id: "d", textFr: "Toronto", textEn: "Toronto" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Interact s’adresse principalement à :",
    promptEn: "Interact is mainly for:",
    choices: [
      { id: "a", textFr: "les collégiens et lycéens", textEn: "middle and high school students" },
      { id: "b", textFr: "les retraités", textEn: "retirees" },
      { id: "c", textFr: "les entreprises partenaires", textEn: "partner companies" },
      { id: "d", textFr: "les seuls présidents de club", textEn: "club presidents only" },
    ],
    correctChoiceId: "a",
  },
  {
    promptFr: "Quelle campagne mondiale emblématique la Fondation Rotary mène-t-elle ?",
    promptEn: "Which global campaign is the Rotary Foundation best known for?",
    choices: [
      { id: "a", textFr: "L’éradication de la polio", textEn: "Polio eradication" },
      { id: "b", textFr: "La conquête spatiale", textEn: "Space exploration" },
      { id: "c", textFr: "Le football scolaire", textEn: "School football" },
      { id: "d", textFr: "Les Jeux olympiques", textEn: "The Olympic Games" },
    ],
    correctChoiceId: "a",
  },
  {
    promptFr: "Quand commence généralement l’année Rotary ?",
    promptEn: "When does the Rotary year usually begin?",
    choices: [
      { id: "a", textFr: "Le 1er janvier", textEn: "1 January" },
      { id: "b", textFr: "Le 1er juillet", textEn: "1 July" },
      { id: "c", textFr: "Le 1er septembre", textEn: "1 September" },
      { id: "d", textFr: "Le 31 décembre", textEn: "31 December" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quel est l’objet de Rotary ?",
    promptEn: "What is the Object of Rotary?",
    choices: [
      { id: "a", textFr: "Organiser des tombolas", textEn: "To organize raffles" },
      { id: "b", textFr: "Encourager et développer l’idéal de service", textEn: "To encourage and foster the ideal of service" },
      { id: "c", textFr: "Former uniquement des chefs d’entreprise", textEn: "To train business leaders only" },
      { id: "d", textFr: "Remplacer les gouvernements locaux", textEn: "To replace local governments" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Un district Rotary est :",
    promptEn: "A Rotary district is:",
    choices: [
      { id: "a", textFr: "un regroupement de clubs d’une zone géographique", textEn: "a grouping of clubs in a geographic area" },
      { id: "b", textFr: "un seul club universitaire", textEn: "a single university club" },
      { id: "c", textFr: "le siège mondial", textEn: "world headquarters" },
      { id: "d", textFr: "un projet de don", textEn: "a donation project" },
    ],
    correctChoiceId: "a",
  },
  {
    promptFr: "Un club Rotaract est généralement parrainé par :",
    promptEn: "A Rotaract club is usually sponsored by:",
    choices: [
      { id: "a", textFr: "une mairie", textEn: "a city hall" },
      { id: "b", textFr: "un club Rotary", textEn: "a Rotary club" },
      { id: "c", textFr: "une banque", textEn: "a bank" },
      { id: "d", textFr: "une équipe de football", textEn: "a football team" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quelle est la deuxième question du Test des 4 questions ?",
    promptEn: "What is the second question of The Four-Way Test?",
    choices: [
      { id: "a", textFr: "Est-ce la vérité ?", textEn: "Is it the truth?" },
      { id: "b", textFr: "Est-ce équitable pour tous les intéressés ?", textEn: "Is it fair to all concerned?" },
      { id: "c", textFr: "Est-ce rentable ?", textEn: "Is it profitable?" },
      { id: "d", textFr: "Est-ce populaire ?", textEn: "Is it popular?" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Un club Rotaract peut être :",
    promptEn: "A Rotaract club can be:",
    choices: [
      { id: "a", textFr: "uniquement en ligne, jamais en présentiel", textEn: "online only, never in person" },
      { id: "b", textFr: "communautaire ou universitaire", textEn: "community-based or university-based" },
      { id: "c", textFr: "réservé aux Rotariens de plus de 50 ans", textEn: "limited to Rotarians over 50" },
      { id: "d", textFr: "fermé aux nouveaux membres", textEn: "closed to new members" },
    ],
    correctChoiceId: "b",
  },
  {
    promptFr: "Quelle est la durée habituelle du mandat d’un président de club ?",
    promptEn: "How long does a club president usually serve?",
    choices: [
      { id: "a", textFr: "Un mois", textEn: "One month" },
      { id: "b", textFr: "Un an", textEn: "One year" },
      { id: "c", textFr: "Cinq ans", textEn: "Five years" },
      { id: "d", textFr: "À vie", textEn: "For life" },
    ],
    correctChoiceId: "b",
  },
];
