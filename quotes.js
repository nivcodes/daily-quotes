// Inspirational Quotes Database
const quotes = [
    {
        text: "Act like your younger self is watching.",
        author: "Unknown"
    },
    {
        text: "The best time to plant a tree was 20 years ago. The second best time is now.",
        author: "Chinese Proverb"
    },
    {
        text: "You are the author of your own story.",
        author: "Unknown"
    },
    {
        text: "What you do today can improve all your tomorrows.",
        author: "Ralph Marston"
    },
    {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs"
    },
    {
        text: "Believe you can and you're halfway there.",
        author: "Theodore Roosevelt"
    },
    {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt"
    },
    {
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius"
    },
    {
        text: "Everything you've ever wanted is on the other side of fear.",
        author: "George Addair"
    },
    {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill"
    },
    {
        text: "Hardships often prepare ordinary people for an extraordinary destiny.",
        author: "C.S. Lewis"
    },
    {
        text: "The only impossible journey is the one you never begin.",
        author: "Tony Robbins"
    },
    {
        text: "In the middle of every difficulty lies opportunity.",
        author: "Albert Einstein"
    },
    {
        text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.",
        author: "Ralph Waldo Emerson"
    },
    {
        text: "You miss 100% of the shots you don't take.",
        author: "Wayne Gretzky"
    },
    {
        text: "The only person you are destined to become is the person you decide to be.",
        author: "Ralph Waldo Emerson"
    },
    {
        text: "Go confidently in the direction of your dreams. Live the life you have imagined.",
        author: "Henry David Thoreau"
    },
    {
        text: "When one door of happiness closes, another opens.",
        author: "Helen Keller"
    },
    {
        text: "Do what you can, with what you have, where you are.",
        author: "Theodore Roosevelt"
    },
    {
        text: "You are never too old to set another goal or to dream a new dream.",
        author: "C.S. Lewis"
    },
    {
        text: "The way to get started is to quit talking and begin doing.",
        author: "Walt Disney"
    },
    {
        text: "Don't watch the clock; do what it does. Keep going.",
        author: "Sam Levenson"
    },
    {
        text: "A year from now you may wish you had started today.",
        author: "Karen Lamb"
    },
    {
        text: "You don't have to be great to start, but you have to start to be great.",
        author: "Zig Ziglar"
    },
    {
        text: "The secret of getting ahead is getting started.",
        author: "Mark Twain"
    },
    {
        text: "Don't be pushed around by the fears in your mind. Be led by the dreams in your heart.",
        author: "Roy T. Bennett"
    },
    {
        text: "Everything you can imagine is real.",
        author: "Pablo Picasso"
    },
    {
        text: "Do one thing every day that scares you.",
        author: "Eleanor Roosevelt"
    },
    {
        text: "It's not whether you get knocked down, it's whether you get up.",
        author: "Vince Lombardi"
    },
    {
        text: "Your limitation—it's only your imagination.",
        author: "Unknown"
    },
    {
        text: "Great things never come from comfort zones.",
        author: "Unknown"
    },
    {
        text: "Dream it. Wish it. Do it.",
        author: "Unknown"
    },
    {
        text: "Success doesn't just find you. You have to go out and get it.",
        author: "Unknown"
    },
    {
        text: "The harder you work for something, the greater you'll feel when you achieve it.",
        author: "Unknown"
    },
    {
        text: "Dream bigger. Do bigger.",
        author: "Unknown"
    },
    {
        text: "Don't stop when you're tired. Stop when you're done.",
        author: "Unknown"
    },
    {
        text: "Wake up with determination. Go to bed with satisfaction.",
        author: "Unknown"
    },
    {
        text: "Do something today that your future self will thank you for.",
        author: "Sean Patrick Flanery"
    },
    {
        text: "Little things make big days.",
        author: "Unknown"
    },
    {
        text: "It's going to be hard, but hard does not mean impossible.",
        author: "Unknown"
    },
    {
        text: "Don't wait for opportunity. Create it.",
        author: "Unknown"
    },
    {
        text: "Sometimes we're tested not to show our weaknesses, but to discover our strengths.",
        author: "Unknown"
    },
    {
        text: "The key to success is to focus on goals, not obstacles.",
        author: "Unknown"
    },
    {
        text: "Dream it. Believe it. Build it.",
        author: "Unknown"
    },
    {
        text: "Your passion is waiting for your courage to catch up.",
        author: "Isabelle Lafleche"
    },
    {
        text: "Magic happens when you don't give up.",
        author: "Unknown"
    },
    {
        text: "Don't tell people your dreams. Show them.",
        author: "Unknown"
    },
    {
        text: "The difference between who you are and who you want to be is what you do.",
        author: "Unknown"
    },
    {
        text: "If it doesn't challenge you, it won't change you.",
        author: "Fred DeVito"
    },
    {
        text: "Make today so awesome, yesterday gets jealous.",
        author: "Unknown"
    },
    {
        text: "You didn't come this far to only come this far.",
        author: "Unknown"
    },
    {
        text: "Be stronger than your excuses.",
        author: "Unknown"
    },
    {
        text: "The only limit to our realization of tomorrow will be our doubts of today.",
        author: "Franklin D. Roosevelt"
    },
    {
        text: "You are braver than you believe, stronger than you seem, and smarter than you think.",
        author: "A.A. Milne"
    },
    {
        text: "Challenges are what make life interesting. Overcoming them is what makes life meaningful.",
        author: "Joshua J. Marine"
    },
    {
        text: "If you want to lift yourself up, lift up someone else.",
        author: "Booker T. Washington"
    },
    {
        text: "I have not failed. I've just found 10,000 ways that won't work.",
        author: "Thomas Edison"
    },
    {
        text: "A person who never made a mistake never tried anything new.",
        author: "Albert Einstein"
    },
    {
        text: "The person who says it cannot be done should not interrupt the person who is doing it.",
        author: "Chinese Proverb"
    },
    {
        text: "There are no traffic jams along the extra mile.",
        author: "Roger Staubach"
    },
    {
        text: "It is never too late to be what you might have been.",
        author: "George Eliot"
    },
    {
        text: "You become what you believe.",
        author: "Oprah Winfrey"
    },
    {
        text: "I would rather die of passion than of boredom.",
        author: "Vincent van Gogh"
    },
    {
        text: "A truly rich man is one whose children run into his arms when his hands are empty.",
        author: "Unknown"
    },
    {
        text: "It is not what you do for your children, but what you have taught them to do for themselves.",
        author: "Ann Landers"
    },
    {
        text: "Build your own dreams, or someone else will hire you to build theirs.",
        author: "Farrah Gray"
    },
    {
        text: "The battles that count aren't the ones for gold medals. The struggles within yourself are the toughest.",
        author: "Jesse Owens"
    },
    {
        text: "Education costs money. But then so does ignorance.",
        author: "Sir Claus Moser"
    },
    {
        text: "I have learned over the years that when one's mind is made up, this diminishes fear.",
        author: "Rosa Parks"
    },
    {
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius"
    },
    {
        text: "If you look at what you have in life, you'll always have more.",
        author: "Oprah Winfrey"
    },
    {
        text: "Remember that not getting what you want is sometimes a wonderful stroke of luck.",
        author: "Dalai Lama"
    },
    {
        text: "You can't use up creativity. The more you use, the more you have.",
        author: "Maya Angelou"
    },
    {
        text: "Dream big and dare to fail.",
        author: "Norman Vaughan"
    },
    {
        text: "Our lives begin to end the day we become silent about things that matter.",
        author: "Martin Luther King Jr."
    },
    {
        text: "Do what you feel in your heart to be right, for you'll be criticized anyway.",
        author: "Eleanor Roosevelt"
    },
    {
        text: "Happiness is not something readymade. It comes from your own actions.",
        author: "Dalai Lama"
    },
    {
        text: "Whatever the mind of man can conceive and believe, it can achieve.",
        author: "Napoleon Hill"
    },
    {
        text: "Strive not to be a success, but rather to be of value.",
        author: "Albert Einstein"
    },
    {
        text: "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.",
        author: "Robert Frost"
    },
    {
        text: "I attribute my success to this: I never gave or took any excuse.",
        author: "Florence Nightingale"
    },
    {
        text: "You miss 100% of the shots you don't take.",
        author: "Wayne Gretzky"
    },
    {
        text: "The most difficult thing is the decision to act, the rest is merely tenacity.",
        author: "Amelia Earhart"
    },
    {
        text: "Every strike brings me closer to the next home run.",
        author: "Babe Ruth"
    },
    {
        text: "Definiteness of purpose is the starting point of all achievement.",
        author: "W. Clement Stone"
    },
    {
        text: "Life isn't about getting and having, it's about giving and being.",
        author: "Kevin Kruse"
    },
    {
        text: "Life is what happens to you while you're busy making other plans.",
        author: "John Lennon"
    },
    {
        text: "We become what we think about.",
        author: "Earl Nightingale"
    },
    {
        text: "Twenty years from now you will be more disappointed by the things that you didn't do than by the ones you did do.",
        author: "Mark Twain"
    },
    {
        text: "Life is 10% what happens to me and 90% of how I react to it.",
        author: "Charles Swindoll"
    },
    {
        text: "The most common way people give up their power is by thinking they don't have any.",
        author: "Alice Walker"
    },
    {
        text: "The mind is everything. What you think you become.",
        author: "Buddha"
    },
    {
        text: "The best time to plant a tree was 20 years ago. The second best time is now.",
        author: "Chinese Proverb"
    },
    {
        text: "An unexamined life is not worth living.",
        author: "Socrates"
    },
    {
        text: "Eighty percent of success is showing up.",
        author: "Woody Allen"
    },
    {
        text: "Your time is limited, so don't waste it living someone else's life.",
        author: "Steve Jobs"
    },
    {
        text: "Winning isn't everything, but wanting to win is.",
        author: "Vince Lombardi"
    },
    {
        text: "I am not a product of my circumstances. I am a product of my decisions.",
        author: "Stephen Covey"
    },
    {
        text: "Every child is an artist. The problem is how to remain an artist once he grows up.",
        author: "Pablo Picasso"
    },
    {
        text: "You can never cross the ocean until you have the courage to lose sight of the shore.",
        author: "Christopher Columbus"
    },
    {
        text: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
        author: "Maya Angelou"
    },
    {
        text: "Either you run the day, or the day runs you.",
        author: "Jim Rohn"
    },
    {
        text: "Whether you think you can or you think you can't, you're right.",
        author: "Henry Ford"
    },
    {
        text: "The two most important days in your life are the day you are born and the day you find out why.",
        author: "Mark Twain"
    },
    {
        text: "Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.",
        author: "Johann Wolfgang von Goethe"
    },
    {
        text: "The best revenge is massive success.",
        author: "Frank Sinatra"
    },
    {
        text: "People often say that motivation doesn't last. Well, neither does bathing. That's why we recommend it daily.",
        author: "Zig Ziglar"
    },
    {
        text: "Life shrinks or expands in proportion to one's courage.",
        author: "Anais Nin"
    },
    {
        text: "If you hear a voice within you say 'you cannot paint,' then by all means paint and that voice will be silenced.",
        author: "Vincent Van Gogh"
    },
    {
        text: "There is only one way to avoid criticism: do nothing, say nothing, and be nothing.",
        author: "Aristotle"
    },
    {
        text: "Ask and it will be given to you; search, and you will find; knock and the door will be opened for you.",
        author: "Jesus"
    },
    {
        text: "The only person you are destined to become is the person you decide to be.",
        author: "Ralph Waldo Emerson"
    },
    {
        text: "Believe in yourself. You are braver than you think, more talented than you know, and capable of more than you imagine.",
        author: "Roy T. Bennett"
    },
    {
        text: "I learned that courage was not the absence of fear, but the triumph over it.",
        author: "Nelson Mandela"
    },
    {
        text: "There is no greater agony than bearing an untold story inside you.",
        author: "Maya Angelou"
    },
    {
        text: "Everything has beauty, but not everyone can see.",
        author: "Confucius"
    },
    {
        text: "It is our choices that show what we truly are, far more than our abilities.",
        author: "J.K. Rowling"
    },
    {
        text: "Try to be a rainbow in someone's cloud.",
        author: "Maya Angelou"
    },
    {
        text: "Start where you are. Use what you have. Do what you can.",
        author: "Arthur Ashe"
    }
];