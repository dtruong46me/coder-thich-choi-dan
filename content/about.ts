// About page content. Personal details live here, not in the database: edit and redeploy.
// [BRACKETED] values are placeholders to fill in.

export const ABOUT = {
  intro: {
    en: [
      "I'm Dinh Truong, a [YOUR ROLE] who grew up on Bách Khoa deadlines and now lives in Japan. By day I write code. By night I pick up a guitar or sit at the piano and get it wrong until it sounds right.",
      "This site is my notebook. I write about what I'm learning, from code and music practice to Japanese and student life, hoping it saves someone a few hours.",
    ],
    vi: [
      'Mình là Đình Trường, [VAI TRÒ CỦA BẠN], từng là sinh viên Bách Khoa và hiện đang sống ở Nhật. Ban ngày mình viết code. Buổi tối thì ôm đàn guitar hoặc ngồi trước cây piano, tập sai cho đến khi nghe ổn.',
      'Trang này là cuốn sổ tay của mình. Mình viết về những gì đang học, từ code, luyện đàn cho tới tiếng Nhật và đời sinh viên, mong là giúp ai đó tiết kiệm được vài giờ.',
    ],
  },
  timeline: [
    { when: '[YEAR] - now', role: '[YOUR ROLE]', where: '[COMPANY], Japan', lang: 'en' },
    { when: '[YEAR] - [YEAR]', role: '[PREVIOUS ROLE]', where: '[COMPANY]', lang: 'en' },
    { when: '[YEAR] - [YEAR]', role: 'Đại học Bách Khoa', where: '[YOUR MAJOR]', lang: 'vi' },
  ],
  skills: ['Python', 'JavaScript', 'TypeScript', '[SKILL]', 'Git', 'LaTeX'],
  languages: [
    ['Tiếng Việt', 'Native', 'vi'],
    ['English', '[LEVEL]', 'en'],
    ['日本語', '[LEVEL]', 'ja'],
  ],
  music: [
    ['Guitar', 'Fingerstyle, [YEARS] years'],
    ['Piano', 'Self-taught, still learning'],
  ],
  cvUrl: '#',
}
