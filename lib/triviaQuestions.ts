export interface TriviaQuestion {
  q: string
  options: string[]
  answer: number // index into options
  subject: string
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // ── Science & Nature ────────────────────────────────────────────────────────
  { q: 'What is the chemical symbol for gold?', options: ['Au', 'Ag', 'Gd', 'Go'], answer: 0, subject: 'Science' },
  { q: 'How many bones are in the adult human body?', options: ['206', '212', '198', '220'], answer: 0, subject: 'Science' },
  { q: 'What is the powerhouse of the cell?', options: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi apparatus'], answer: 0, subject: 'Science' },
  { q: 'What planet is known as the Red Planet?', options: ['Mars', 'Jupiter', 'Venus', 'Saturn'], answer: 0, subject: 'Science' },
  { q: 'What is H2O?', options: ['Water', 'Hydrogen peroxide', 'Hydrochloric acid', 'Ammonia'], answer: 0, subject: 'Science' },
  { q: 'What is the speed of light?', options: ['3×10⁸ m/s', '3×10⁶ m/s', '3×10⁷ m/s', '3×10⁹ m/s'], answer: 0, subject: 'Science' },
  { q: 'What gas do plants absorb from the atmosphere?', options: ['CO₂', 'O₂', 'N₂', 'H₂'], answer: 0, subject: 'Science' },
  { q: 'What is the atomic number of carbon?', options: ['6', '12', '8', '14'], answer: 0, subject: 'Science' },
  { q: 'Which planet has the most moons?', options: ['Saturn', 'Jupiter', 'Uranus', 'Neptune'], answer: 0, subject: 'Science' },
  { q: 'What is the hardest natural substance?', options: ['Diamond', 'Titanium', 'Quartz', 'Graphite'], answer: 0, subject: 'Science' },
  { q: 'What organ produces insulin?', options: ['Pancreas', 'Liver', 'Kidney', 'Spleen'], answer: 0, subject: 'Science' },
  { q: 'What is the most abundant gas in Earth\'s atmosphere?', options: ['Nitrogen', 'Oxygen', 'Argon', 'CO₂'], answer: 0, subject: 'Science' },
  { q: 'DNA stands for?', options: ['Deoxyribonucleic acid', 'Dinitrogen acid', 'Deoxynitrogenous acid', 'Dioxyribose acid'], answer: 0, subject: 'Science' },
  { q: 'What is the chemical formula for table salt?', options: ['NaCl', 'KCl', 'NaBr', 'MgCl₂'], answer: 0, subject: 'Science' },
  { q: 'How many planets are in the solar system?', options: ['8', '9', '7', '10'], answer: 0, subject: 'Science' },
  { q: 'What force keeps planets in orbit?', options: ['Gravity', 'Magnetism', 'Friction', 'Nuclear force'], answer: 0, subject: 'Science' },
  { q: 'Which blood type is the universal donor?', options: ['O-', 'A+', 'AB+', 'B-'], answer: 0, subject: 'Science' },
  { q: 'What is photosynthesis?', options: ['Converting sunlight to food', 'Breaking down food', 'Absorbing water', 'Releasing CO₂'], answer: 0, subject: 'Science' },
  { q: 'What part of the brain controls balance?', options: ['Cerebellum', 'Cerebrum', 'Medulla', 'Thalamus'], answer: 0, subject: 'Science' },
  { q: 'How many chromosomes does a human have?', options: ['46', '48', '44', '52'], answer: 0, subject: 'Science' },
  { q: 'What is the closest star to Earth?', options: ['The Sun', 'Proxima Centauri', 'Sirius', 'Alpha Centauri'], answer: 0, subject: 'Science' },
  { q: 'What element has the symbol Fe?', options: ['Iron', 'Fluorine', 'Francium', 'Fermium'], answer: 0, subject: 'Science' },
  { q: 'What is the boiling point of water at sea level?', options: ['100°C', '90°C', '110°C', '212°F'], answer: 0, subject: 'Science' },
  { q: 'What is Newton\'s first law?', options: ['Law of inertia', 'Law of gravity', 'Law of energy', 'Law of motion'], answer: 0, subject: 'Science' },
  { q: 'What is the pH of pure water?', options: ['7', '6', '8', '5'], answer: 0, subject: 'Science' },
  { q: 'What type of animal is a dolphin?', options: ['Mammal', 'Fish', 'Reptile', 'Amphibian'], answer: 0, subject: 'Science' },
  { q: 'What is the largest organ in the human body?', options: ['Skin', 'Liver', 'Lungs', 'Intestine'], answer: 0, subject: 'Science' },
  { q: 'What gas is released during respiration?', options: ['CO₂', 'O₂', 'N₂', 'H₂O'], answer: 0, subject: 'Science' },
  { q: 'How long does it take light to travel from the Sun to Earth?', options: ['~8 minutes', '~1 hour', '~1 second', '~1 day'], answer: 0, subject: 'Science' },
  { q: 'What is the nucleus of an atom made of?', options: ['Protons and neutrons', 'Protons only', 'Electrons', 'Quarks only'], answer: 0, subject: 'Science' },

  // ── Mathematics ────────────────────────────────────────────────────────────
  { q: 'What is the value of π (pi) to 2 decimal places?', options: ['3.14', '3.12', '3.16', '3.18'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 15% of 200?', options: ['30', '25', '35', '20'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the square root of 144?', options: ['12', '14', '11', '13'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the sum of angles in a triangle?', options: ['180°', '360°', '90°', '270°'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 2⁸?', options: ['256', '128', '512', '64'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the formula for the area of a circle?', options: ['πr²', '2πr', 'πd', 'πr'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the Pythagorean theorem?', options: ['a²+b²=c²', 'a+b=c', 'a²-b²=c', 'ab=c²'], answer: 0, subject: 'Mathematics' },
  { q: 'What is a prime number?', options: ['Divisible only by 1 and itself', 'Even number', 'Divisible by 3', 'Odd number'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the next prime number after 7?', options: ['11', '9', '10', '13'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 0!?', options: ['1', '0', 'Undefined', 'Infinity'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the derivative of x²?', options: ['2x', 'x', '2', 'x²'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the GCF of 12 and 18?', options: ['6', '3', '9', '12'], answer: 0, subject: 'Mathematics' },
  { q: 'What number is neither prime nor composite?', options: ['1', '0', '2', '4'], answer: 0, subject: 'Mathematics' },
  { q: 'How many sides does a hexagon have?', options: ['6', '5', '7', '8'], answer: 0, subject: 'Mathematics' },
  { q: 'What is log₁₀(1000)?', options: ['3', '4', '2', '10'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the slope of a horizontal line?', options: ['0', '1', 'Undefined', '-1'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the LCM of 4 and 6?', options: ['12', '24', '6', '8'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 3/4 as a decimal?', options: ['0.75', '0.25', '0.5', '0.80'], answer: 0, subject: 'Mathematics' },
  { q: 'How many degrees in a right angle?', options: ['90°', '45°', '180°', '60°'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the volume formula for a sphere?', options: ['(4/3)πr³', '(2/3)πr³', 'πr²h', '4πr²'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the result of 7 × 8?', options: ['56', '48', '64', '54'], answer: 0, subject: 'Mathematics' },
  { q: 'What is an isosceles triangle?', options: ['2 equal sides', '3 equal sides', 'No equal sides', '1 equal side'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 10% of 500?', options: ['50', '100', '25', '75'], answer: 0, subject: 'Mathematics' },
  { q: 'What is the quadratic formula result for x in x²-5x+6=0?', options: ['x=2 or x=3', 'x=1 or x=6', 'x=-2 or x=-3', 'x=4 or x=1'], answer: 0, subject: 'Mathematics' },
  { q: 'What is 100 in Roman numerals?', options: ['C', 'L', 'D', 'M'], answer: 0, subject: 'Mathematics' },

  // ── Technology ─────────────────────────────────────────────────────────────
  { q: 'What does CPU stand for?', options: ['Central Processing Unit', 'Core Processing Unit', 'Central Program Unit', 'Computer Processing Unit'], answer: 0, subject: 'Technology' },
  { q: 'What language is primarily used for Android development?', options: ['Kotlin / Java', 'Swift', 'Python', 'C#'], answer: 0, subject: 'Technology' },
  { q: 'What does HTML stand for?', options: ['HyperText Markup Language', 'High-level Text Machine Language', 'HyperText Management Language', 'Hyperlink Text Markup Language'], answer: 0, subject: 'Technology' },
  { q: 'What is the binary for 10?', options: ['1010', '1100', '0110', '1001'], answer: 0, subject: 'Technology' },
  { q: 'What does RAM stand for?', options: ['Random Access Memory', 'Read-only Access Memory', 'Random Active Memory', 'Read Access Module'], answer: 0, subject: 'Technology' },
  { q: 'Who founded Apple?', options: ['Steve Jobs & Steve Wozniak', 'Bill Gates', 'Elon Musk', 'Mark Zuckerberg'], answer: 0, subject: 'Technology' },
  { q: 'What is the default port for HTTP?', options: ['80', '443', '8080', '22'], answer: 0, subject: 'Technology' },
  { q: 'What does API stand for?', options: ['Application Programming Interface', 'Applied Programming Interface', 'Application Program Integration', 'Active Program Interface'], answer: 0, subject: 'Technology' },
  { q: 'What is 1 byte equal to?', options: ['8 bits', '4 bits', '16 bits', '2 bits'], answer: 0, subject: 'Technology' },
  { q: 'What language is React built with?', options: ['JavaScript', 'Python', 'Ruby', 'C++'], answer: 0, subject: 'Technology' },
  { q: 'What does SQL stand for?', options: ['Structured Query Language', 'Standard Query Language', 'Structured Question Language', 'System Query Language'], answer: 0, subject: 'Technology' },
  { q: 'What is Git used for?', options: ['Version control', 'Database management', 'Web hosting', 'Server management'], answer: 0, subject: 'Technology' },
  { q: 'What does VPN stand for?', options: ['Virtual Private Network', 'Very Private Network', 'Virtual Protected Network', 'Verified Private Node'], answer: 0, subject: 'Technology' },
  { q: 'What year was the first iPhone released?', options: ['2007', '2005', '2009', '2008'], answer: 0, subject: 'Technology' },
  { q: 'What does URL stand for?', options: ['Uniform Resource Locator', 'Universal Resource Link', 'Unique Reference Locator', 'Unified Resource Locator'], answer: 0, subject: 'Technology' },
  { q: 'What is the name of Google\'s AI assistant?', options: ['Google Assistant', 'Cortana', 'Siri', 'Alexa'], answer: 0, subject: 'Technology' },
  { q: 'What is an algorithm?', options: ['Step-by-step problem-solving procedure', 'A type of computer virus', 'Programming language', 'Database format'], answer: 0, subject: 'Technology' },
  { q: 'What does IoT stand for?', options: ['Internet of Things', 'Integration of Technology', 'Interface of Terminals', 'Internet of Terminals'], answer: 0, subject: 'Technology' },
  { q: 'What programming language is known as the language of the web?', options: ['JavaScript', 'Python', 'Java', 'PHP'], answer: 0, subject: 'Technology' },
  { q: 'What does CSS stand for?', options: ['Cascading Style Sheets', 'Creative Style System', 'Cascading Sheet System', 'Computer Style Sheets'], answer: 0, subject: 'Technology' },
  { q: 'What is machine learning?', options: ['AI learning from data', 'Teaching machines manually', 'Programming robots', 'Data storage system'], answer: 0, subject: 'Technology' },
  { q: 'Which company makes the PlayStation?', options: ['Sony', 'Microsoft', 'Nintendo', 'Sega'], answer: 0, subject: 'Technology' },
  { q: 'What is blockchain?', options: ['Decentralized digital ledger', 'Type of internet', 'Social media platform', 'Cloud storage'], answer: 0, subject: 'Technology' },
  { q: 'What does OS stand for?', options: ['Operating System', 'Open Source', 'Online Server', 'Output System'], answer: 0, subject: 'Technology' },
  { q: 'What is Wi-Fi?', options: ['Wireless networking technology', 'Wired internet format', 'Wide-area internet protocol', 'Wireless FM radio'], answer: 0, subject: 'Technology' },

  // ── History ────────────────────────────────────────────────────────────────
  { q: 'In what year did World War II end?', options: ['1945', '1943', '1947', '1950'], answer: 0, subject: 'History' },
  { q: 'Who was the first President of the United States?', options: ['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams'], answer: 0, subject: 'History' },
  { q: 'What empire did Julius Caesar lead?', options: ['Roman Empire', 'Greek Empire', 'Ottoman Empire', 'Byzantine Empire'], answer: 0, subject: 'History' },
  { q: 'When did the Berlin Wall fall?', options: ['1989', '1991', '1985', '1979'], answer: 0, subject: 'History' },
  { q: 'Which country was Nelson Mandela President of?', options: ['South Africa', 'Nigeria', 'Kenya', 'Ghana'], answer: 0, subject: 'History' },
  { q: 'What ancient wonder was located in Alexandria?', options: ['The Lighthouse', 'The Colossus', 'The Pyramids', 'The Hanging Gardens'], answer: 0, subject: 'History' },
  { q: 'What year did Columbus reach the Americas?', options: ['1492', '1482', '1502', '1512'], answer: 0, subject: 'History' },
  { q: 'Who invented the telephone?', options: ['Alexander Graham Bell', 'Thomas Edison', 'Nikola Tesla', 'Guglielmo Marconi'], answer: 0, subject: 'History' },
  { q: 'What was the first country to give women the right to vote?', options: ['New Zealand', 'USA', 'UK', 'Sweden'], answer: 0, subject: 'History' },
  { q: 'Who painted the Mona Lisa?', options: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Caravaggio'], answer: 0, subject: 'History' },
  { q: 'The Great Wall of China was primarily built during which dynasty?', options: ['Ming Dynasty', 'Han Dynasty', 'Qin Dynasty', 'Tang Dynasty'], answer: 0, subject: 'History' },
  { q: 'Who wrote the Declaration of Independence?', options: ['Thomas Jefferson', 'Benjamin Franklin', 'John Adams', 'George Washington'], answer: 0, subject: 'History' },
  { q: 'What year did the Titanic sink?', options: ['1912', '1914', '1910', '1918'], answer: 0, subject: 'History' },
  { q: 'Which country launched the first satellite into space?', options: ['Soviet Union', 'USA', 'Germany', 'China'], answer: 0, subject: 'History' },
  { q: 'What was the name of the first man on the Moon?', options: ['Neil Armstrong', 'Buzz Aldrin', 'Yuri Gagarin', 'Alan Shepard'], answer: 0, subject: 'History' },
  { q: 'In which year did Nigeria gain independence?', options: ['1960', '1963', '1956', '1970'], answer: 0, subject: 'History' },
  { q: 'Who was the first woman to win a Nobel Prize?', options: ['Marie Curie', 'Rosalind Franklin', 'Florence Nightingale', 'Ada Lovelace'], answer: 0, subject: 'History' },
  { q: 'Which empire built the Colosseum?', options: ['Roman Empire', 'Greek Empire', 'Byzantine Empire', 'Ottoman Empire'], answer: 0, subject: 'History' },
  { q: 'What ancient document is considered the first constitution?', options: ['Magna Carta', 'Bill of Rights', 'Hammurabi\'s Code', 'Cyrus Cylinder'], answer: 0, subject: 'History' },
  { q: 'The Cold War was between the USA and?', options: ['Soviet Union', 'China', 'Germany', 'Cuba'], answer: 0, subject: 'History' },
  { q: 'Who led the Indian independence movement?', options: ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Bhagat Singh', 'Subhas Chandra Bose'], answer: 0, subject: 'History' },
  { q: 'In what year did the French Revolution begin?', options: ['1789', '1776', '1799', '1815'], answer: 0, subject: 'History' },
  { q: 'What was the name of the apartheid system in South Africa?', options: ['Apartheid', 'Segregation', 'Partition', 'Colonialism'], answer: 0, subject: 'History' },
  { q: 'Which treaty ended World War I?', options: ['Treaty of Versailles', 'Treaty of Paris', 'Treaty of Berlin', 'Treaty of Vienna'], answer: 0, subject: 'History' },
  { q: 'Who invented the printing press?', options: ['Johannes Gutenberg', 'Galileo Galilei', 'Isaac Newton', 'Benjamin Franklin'], answer: 0, subject: 'History' },

  // ── Geography ──────────────────────────────────────────────────────────────
  { q: 'What is the capital of Nigeria?', options: ['Abuja', 'Lagos', 'Ibadan', 'Kano'], answer: 0, subject: 'Geography' },
  { q: 'What is the largest continent?', options: ['Asia', 'Africa', 'North America', 'Europe'], answer: 0, subject: 'Geography' },
  { q: 'What is the longest river in the world?', options: ['Nile', 'Amazon', 'Yangtze', 'Mississippi'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of France?', options: ['Paris', 'Lyon', 'Marseille', 'Bordeaux'], answer: 0, subject: 'Geography' },
  { q: 'What is the largest ocean?', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 0, subject: 'Geography' },
  { q: 'Which is the smallest country in the world?', options: ['Vatican City', 'Monaco', 'San Marino', 'Liechtenstein'], answer: 0, subject: 'Geography' },
  { q: 'What is the tallest mountain in the world?', options: ['Mount Everest', 'K2', 'Kangchenjunga', 'Makalu'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Japan?', options: ['Tokyo', 'Kyoto', 'Osaka', 'Hiroshima'], answer: 0, subject: 'Geography' },
  { q: 'How many countries are in Africa?', options: ['54', '48', '60', '52'], answer: 0, subject: 'Geography' },
  { q: 'What is the Amazon Rainforest primarily located in?', options: ['Brazil', 'Peru', 'Colombia', 'Venezuela'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Australia?', options: ['Canberra', 'Sydney', 'Melbourne', 'Brisbane'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Ghana?', options: ['Accra', 'Kumasi', 'Tamale', 'Cape Coast'], answer: 0, subject: 'Geography' },
  { q: 'Which country has the most population?', options: ['India', 'China', 'USA', 'Indonesia'], answer: 0, subject: 'Geography' },
  { q: 'What river runs through Egypt?', options: ['Nile', 'Congo', 'Niger', 'Zambezi'], answer: 0, subject: 'Geography' },
  { q: 'What is the largest country by area?', options: ['Russia', 'Canada', 'USA', 'China'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Kenya?', options: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'], answer: 0, subject: 'Geography' },
  { q: 'Which sea is the saltiest?', options: ['Dead Sea', 'Red Sea', 'Mediterranean Sea', 'Caspian Sea'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of South Africa?', options: ['Pretoria', 'Cape Town', 'Johannesburg', 'Durban'], answer: 0, subject: 'Geography' },
  { q: 'What continent is Egypt in?', options: ['Africa', 'Asia', 'Europe', 'Middle East'], answer: 0, subject: 'Geography' },
  { q: 'What is the currency of Japan?', options: ['Yen', 'Won', 'Yuan', 'Ringgit'], answer: 0, subject: 'Geography' },
  { q: 'Which country has the highest number of pyramids?', options: ['Sudan', 'Egypt', 'Mexico', 'Peru'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Canada?', options: ['Ottawa', 'Toronto', 'Montreal', 'Vancouver'], answer: 0, subject: 'Geography' },
  { q: 'What desert is the largest in the world?', options: ['Antarctic Desert', 'Sahara', 'Arabian Desert', 'Gobi Desert'], answer: 0, subject: 'Geography' },
  { q: 'What is the official language of Brazil?', options: ['Portuguese', 'Spanish', 'English', 'French'], answer: 0, subject: 'Geography' },
  { q: 'What is the capital of Germany?', options: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'], answer: 0, subject: 'Geography' },

  // ── Campus Life ─────────────────────────────────────────────────────────────
  { q: 'What is the typical length of a university degree in Nigeria?', options: ['4-5 years', '2-3 years', '6-7 years', '1-2 years'], answer: 0, subject: 'Campus Life' },
  { q: 'What does GPA stand for?', options: ['Grade Point Average', 'General Performance Average', 'Grade Progress Assessment', 'General Point Assessment'], answer: 0, subject: 'Campus Life' },
  { q: 'What is a student council?', options: ['Student representative body', 'Academic committee', 'Faculty board', 'Exam committee'], answer: 0, subject: 'Campus Life' },
  { q: 'What does CGPA stand for?', options: ['Cumulative Grade Point Average', 'Current Grade Point Average', 'Combined General Performance Average', 'Campus GPA'], answer: 0, subject: 'Campus Life' },
  { q: 'What is matriculation?', options: ['Formal admission to a university', 'Final exams', 'Graduation ceremony', 'Course registration'], answer: 0, subject: 'Campus Life' },
  { q: 'What is a semester?', options: ['Half-year academic period', 'Full academic year', 'Three-month period', 'One-month period'], answer: 0, subject: 'Campus Life' },
  { q: 'What does JAMB stand for?', options: ['Joint Admissions and Matriculation Board', 'Joint Academic Management Board', 'Junior Academic Management Board', 'Joint Admissions and Management Board'], answer: 0, subject: 'Campus Life' },
  { q: 'What is a thesis?', options: ['Long research paper for advanced degrees', 'Short quiz', 'Class assignment', 'Attendance sheet'], answer: 0, subject: 'Campus Life' },
  { q: 'What is plagiarism?', options: ['Using others\' work without credit', 'Original research', 'Collaborative work', 'Peer review'], answer: 0, subject: 'Campus Life' },
  { q: 'What does Dean mean in a university context?', options: ['Head of a faculty', 'Senior student', 'Admin staff', 'Head of the university'], answer: 0, subject: 'Campus Life' },
  { q: 'What is a hostel in a university?', options: ['Student residential hall', 'Cafeteria', 'Library', 'Lab'], answer: 0, subject: 'Campus Life' },
  { q: 'What is the role of a teaching assistant?', options: ['Help professors with teaching', 'Manage student council', 'Oversee hostel', 'Control library'], answer: 0, subject: 'Campus Life' },
  { q: 'What is an elective course?', options: ['Optional course', 'Compulsory course', 'Lab practical', 'Core requirement'], answer: 0, subject: 'Campus Life' },
  { q: 'What is peer tutoring?', options: ['Students teaching other students', 'Professors teaching', 'Online teaching', 'Group exams'], answer: 0, subject: 'Campus Life' },
  { q: 'What is an internship?', options: ['Temporary work experience', 'University club', 'Academic project', 'Research paper'], answer: 0, subject: 'Campus Life' },

  // ── Sports ─────────────────────────────────────────────────────────────────
  { q: 'How many players are on a football team on the field?', options: ['11', '10', '12', '9'], answer: 0, subject: 'Sports' },
  { q: 'What sport is played at Wimbledon?', options: ['Tennis', 'Cricket', 'Golf', 'Badminton'], answer: 0, subject: 'Sports' },
  { q: 'How often is the FIFA World Cup held?', options: ['Every 4 years', 'Every 2 years', 'Every year', 'Every 6 years'], answer: 0, subject: 'Sports' },
  { q: 'Which country won the first FIFA World Cup in 1930?', options: ['Uruguay', 'Brazil', 'Argentina', 'Italy'], answer: 0, subject: 'Sports' },
  { q: 'What is the highest score in a single bowler\'s game (10-pin bowling)?', options: ['300', '200', '250', '350'], answer: 0, subject: 'Sports' },
  { q: 'How many rings are on the Olympic flag?', options: ['5', '4', '6', '3'], answer: 0, subject: 'Sports' },
  { q: 'In basketball, how many points is a three-pointer worth?', options: ['3', '2', '1', '4'], answer: 0, subject: 'Sports' },
  { q: 'What country has won the most FIFA World Cups?', options: ['Brazil', 'Germany', 'Italy', 'Argentina'], answer: 0, subject: 'Sports' },
  { q: 'How many players are on a basketball team during play?', options: ['5', '6', '4', '7'], answer: 0, subject: 'Sports' },
  { q: 'What is the distance of a marathon?', options: ['42.195 km', '40 km', '45 km', '26 km'], answer: 0, subject: 'Sports' },
  { q: 'Which sport uses a shuttlecock?', options: ['Badminton', 'Tennis', 'Squash', 'Volleyball'], answer: 0, subject: 'Sports' },
  { q: 'Who holds the record for most Olympic gold medals?', options: ['Michael Phelps', 'Usain Bolt', 'Carl Lewis', 'Mark Spitz'], answer: 0, subject: 'Sports' },
  { q: 'In cricket, what is a "duck"?', options: ['Scoring 0 runs', 'Hitting six boundaries', 'A type of delivery', 'Fielding position'], answer: 0, subject: 'Sports' },
  { q: 'What is the national sport of Nigeria?', options: ['Football', 'Basketball', 'Athletics', 'Wrestling'], answer: 0, subject: 'Sports' },
  { q: 'How many sets are in a standard tennis match for men?', options: ['5', '3', '4', '2'], answer: 0, subject: 'Sports' },

  // ── General Knowledge ──────────────────────────────────────────────────────
  { q: 'What is the currency of the UK?', options: ['Pound Sterling', 'Euro', 'Dollar', 'Franc'], answer: 0, subject: 'General Knowledge' },
  { q: 'How many colors are in a rainbow?', options: ['7', '6', '5', '8'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the most spoken language in the world?', options: ['Mandarin Chinese', 'English', 'Spanish', 'Hindi'], answer: 0, subject: 'General Knowledge' },
  { q: 'What animal is known as the king of the jungle?', options: ['Lion', 'Tiger', 'Elephant', 'Gorilla'], answer: 0, subject: 'General Knowledge' },
  { q: 'What instrument has 88 keys?', options: ['Piano', 'Organ', 'Xylophone', 'Accordion'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the largest mammal on Earth?', options: ['Blue Whale', 'African Elephant', 'Sperm Whale', 'Giraffe'], answer: 0, subject: 'General Knowledge' },
  { q: 'How many hours are in a week?', options: ['168', '144', '196', '172'], answer: 0, subject: 'General Knowledge' },
  { q: 'What does WWW stand for?', options: ['World Wide Web', 'World Wireless Web', 'Wide World Web', 'World Wide Wire'], answer: 0, subject: 'General Knowledge' },
  { q: 'Which ocean is on the west coast of Africa?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the opposite of nocturnal?', options: ['Diurnal', 'Crepuscular', 'Arboreal', 'Aquatic'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the boiling point of water in Fahrenheit?', options: ['212°F', '100°F', '180°F', '220°F'], answer: 0, subject: 'General Knowledge' },
  { q: 'How many continents are on Earth?', options: ['7', '6', '5', '8'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the national animal of Nigeria?', options: ['Eagle', 'Lion', 'Elephant', 'Leopard'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the UN?', options: ['United Nations', 'Universal Network', 'United Nations of NATO', 'Unified Nations'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the fastest land animal?', options: ['Cheetah', 'Lion', 'Horse', 'Greyhound'], answer: 0, subject: 'General Knowledge' },
  { q: 'What does NASA stand for?', options: ['National Aeronautics and Space Administration', 'National Astronomy Science Agency', 'North American Space Association', 'National Air and Space Agency'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the most recycled material in the world?', options: ['Steel', 'Glass', 'Paper', 'Plastic'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the global timezone reference called?', options: ['UTC', 'GMT', 'EST', 'IST'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the rarest blood type?', options: ['AB-', 'O-', 'B-', 'A-'], answer: 0, subject: 'General Knowledge' },
  { q: 'How many days are in a leap year?', options: ['366', '365', '367', '364'], answer: 0, subject: 'General Knowledge' },
  { q: 'What color does litmus paper turn in acid?', options: ['Red', 'Blue', 'Purple', 'Yellow'], answer: 0, subject: 'General Knowledge' },
  { q: 'What is the official language of Brazil?', options: ['Portuguese', 'Spanish', 'English', 'Italian'], answer: 0, subject: 'General Knowledge' },
  { q: 'How many strings does a standard guitar have?', options: ['6', '4', '8', '12'], answer: 0, subject: 'General Knowledge' },
  { q: 'What does DIY stand for?', options: ['Do It Yourself', 'Do It Your Way', 'Design It Yourself', 'Draft It Yourself'], answer: 0, subject: 'General Knowledge' },
  { q: 'Which planet is closest to the Sun?', options: ['Mercury', 'Venus', 'Earth', 'Mars'], answer: 0, subject: 'General Knowledge' },

  // ── Economics & Business ───────────────────────────────────────────────────
  { q: 'What does GDP stand for?', options: ['Gross Domestic Product', 'General Domestic Production', 'Gross Development Product', 'Government Domestic Product'], answer: 0, subject: 'Economics' },
  { q: 'What is inflation?', options: ['General rise in prices', 'Drop in currency value', 'Increase in interest rates', 'Rise in employment'], answer: 0, subject: 'Economics' },
  { q: 'What is a stock market?', options: ['Market for buying/selling company shares', 'Government bank', 'Currency exchange', 'Bond market'], answer: 0, subject: 'Economics' },
  { q: 'What does ROI stand for?', options: ['Return On Investment', 'Rate Of Interest', 'Return On Income', 'Revenue Of Income'], answer: 0, subject: 'Economics' },
  { q: 'What is supply and demand?', options: ['Economic model of pricing', 'Business accounting', 'Market regulation', 'Tax policy'], answer: 0, subject: 'Economics' },
  { q: 'What is a recession?', options: ['2+ quarters of negative GDP growth', 'Drop in unemployment', 'Currency appreciation', 'Market boom'], answer: 0, subject: 'Economics' },
  { q: 'What does IPO stand for?', options: ['Initial Public Offering', 'International Purchase Order', 'Initial Product Offer', 'Integrated Public Offering'], answer: 0, subject: 'Economics' },
  { q: 'What is a budget deficit?', options: ['Spending exceeds revenue', 'Revenue exceeds spending', 'Equal spending and income', 'Reduced government spending'], answer: 0, subject: 'Economics' },
  { q: 'What is compound interest?', options: ['Interest on principal + accumulated interest', 'Interest on principal only', 'Fixed rate interest', 'Annual fixed payment'], answer: 0, subject: 'Economics' },
  { q: 'What is cryptocurrency?', options: ['Digital decentralized currency', 'Government-backed digital money', 'Credit card system', 'Mobile payment method'], answer: 0, subject: 'Economics' },
  { q: 'What does B2B mean?', options: ['Business to Business', 'Back to Business', 'Business to Brand', 'Brand to Business'], answer: 0, subject: 'Economics' },
  { q: 'What is a monopoly?', options: ['Single seller dominates a market', 'Many sellers compete', 'Two sellers share market', 'Government-controlled market'], answer: 0, subject: 'Economics' },
  { q: 'What is fiscal policy?', options: ['Government spending and taxation policy', 'Central bank interest rate policy', 'Trade regulation', 'Foreign exchange policy'], answer: 0, subject: 'Economics' },
  { q: 'What is an entrepreneur?', options: ['Person who creates and runs a business', 'Government employee', 'Investor only', 'Business consultant'], answer: 0, subject: 'Economics' },
  { q: 'What is the World Bank?', options: ['International development financial institution', 'The largest commercial bank', 'US Federal Reserve', 'Stock exchange'], answer: 0, subject: 'Economics' },

  // ── Literature & Arts ──────────────────────────────────────────────────────
  { q: 'Who wrote "Things Fall Apart"?', options: ['Chinua Achebe', 'Wole Soyinka', 'Ngugi wa Thiong\'o', 'Ben Okri'], answer: 0, subject: 'Literature' },
  { q: 'Who wrote Romeo and Juliet?', options: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'John Milton'], answer: 0, subject: 'Literature' },
  { q: 'What is a sonnet?', options: ['14-line poem', '10-line poem', '4-stanza poem', '8-line poem'], answer: 0, subject: 'Literature' },
  { q: 'Who wrote "1984"?', options: ['George Orwell', 'Aldous Huxley', 'Franz Kafka', 'H.G. Wells'], answer: 0, subject: 'Literature' },
  { q: 'What is a haiku?', options: ['3-line Japanese poem (5-7-5 syllables)', '4-line poem', '8-line Japanese poem', 'Free verse poem'], answer: 0, subject: 'Literature' },
  { q: 'Who wrote "Pride and Prejudice"?', options: ['Jane Austen', 'Charlotte Brontë', 'Emily Brontë', 'Mary Shelley'], answer: 0, subject: 'Literature' },
  { q: 'What Nigerian author won the Nobel Prize for Literature in 1986?', options: ['Wole Soyinka', 'Chinua Achebe', 'Ben Okri', 'Cyprian Ekwensi'], answer: 0, subject: 'Literature' },
  { q: 'What is the protagonist in a story?', options: ['Main character', 'Villain', 'Narrator', 'Supporting character'], answer: 0, subject: 'Literature' },
  { q: 'What is an allegory?', options: ['Story with hidden symbolic meaning', 'Type of rhyme scheme', 'Short story form', 'Metaphor in poetry'], answer: 0, subject: 'Literature' },
  { q: 'Who wrote "The Great Gatsby"?', options: ['F. Scott Fitzgerald', 'Ernest Hemingway', 'John Steinbeck', 'William Faulkner'], answer: 0, subject: 'Literature' },
  { q: 'What artistic movement was Pablo Picasso associated with?', options: ['Cubism', 'Surrealism', 'Impressionism', 'Abstract Expressionism'], answer: 0, subject: 'Literature' },
  { q: 'What is alliteration?', options: ['Repetition of initial consonant sounds', 'Rhyming at end of lines', 'Comparison using "like" or "as"', 'Giving human traits to objects'], answer: 0, subject: 'Literature' },
  { q: 'Who wrote "Harry Potter"?', options: ['J.K. Rowling', 'J.R.R. Tolkien', 'C.S. Lewis', 'Philip Pullman'], answer: 0, subject: 'Literature' },
  { q: 'What is the Iliad about?', options: ['The Trojan War', 'The journey of Odysseus', 'The founding of Rome', 'The Persian Wars'], answer: 0, subject: 'Literature' },
  { q: 'What is foreshadowing?', options: ['Hinting at future events', 'Describing the setting', 'Flashback technique', 'Dramatic irony'], answer: 0, subject: 'Literature' },

  // ── Health & Nutrition ─────────────────────────────────────────────────────
  { q: 'How many glasses of water should you drink daily?', options: ['8 glasses', '4 glasses', '12 glasses', '6 glasses'], answer: 0, subject: 'Health' },
  { q: 'What vitamin is produced when exposed to sunlight?', options: ['Vitamin D', 'Vitamin C', 'Vitamin A', 'Vitamin B12'], answer: 0, subject: 'Health' },
  { q: 'What is BMI?', options: ['Body Mass Index', 'Body Muscle Index', 'Basal Metabolic Index', 'Blood Mass Indicator'], answer: 0, subject: 'Health' },
  { q: 'What is the normal human body temperature?', options: ['37°C', '36°C', '38°C', '35°C'], answer: 0, subject: 'Health' },
  { q: 'What is a carbohydrate\'s primary role?', options: ['Provide energy', 'Build muscles', 'Repair cells', 'Regulate hormones'], answer: 0, subject: 'Health' },
  { q: 'What organ filters blood in the human body?', options: ['Kidney', 'Liver', 'Heart', 'Spleen'], answer: 0, subject: 'Health' },
  { q: 'What does the immune system do?', options: ['Protects body from disease', 'Regulates blood pressure', 'Controls hormones', 'Produces blood cells only'], answer: 0, subject: 'Health' },
  { q: 'How many calories are in 1 gram of fat?', options: ['9', '4', '7', '5'], answer: 0, subject: 'Health' },
  { q: 'What is insomnia?', options: ['Inability to sleep', 'Excessive sleeping', 'Sleep walking', 'Snoring condition'], answer: 0, subject: 'Health' },
  { q: 'What vitamin prevents scurvy?', options: ['Vitamin C', 'Vitamin D', 'Vitamin A', 'Vitamin B'], answer: 0, subject: 'Health' },
  { q: 'What is mental health?', options: ['Emotional and psychological well-being', 'Physical fitness level', 'Cognitive test score', 'Brain scan result'], answer: 0, subject: 'Health' },
  { q: 'How many chambers does the human heart have?', options: ['4', '2', '3', '6'], answer: 0, subject: 'Health' },
  { q: 'What is hypertension?', options: ['High blood pressure', 'Low blood pressure', 'Rapid heartbeat', 'Irregular heartbeat'], answer: 0, subject: 'Health' },
  { q: 'What is the function of white blood cells?', options: ['Fight infection', 'Carry oxygen', 'Clot blood', 'Digest food'], answer: 0, subject: 'Health' },
  { q: 'What is the recommended daily sleep for adults?', options: ['7-9 hours', '4-6 hours', '10-12 hours', '5-7 hours'], answer: 0, subject: 'Health' },

  // ── Pop Culture & Entertainment ────────────────────────────────────────────
  { q: 'What year was the first iPhone released?', options: ['2007', '2005', '2009', '2006'], answer: 0, subject: 'Pop Culture' },
  { q: 'Which streaming service produced "Stranger Things"?', options: ['Netflix', 'Amazon Prime', 'Disney+', 'HBO Max'], answer: 0, subject: 'Pop Culture' },
  { q: 'What does GOAT stand for in sports culture?', options: ['Greatest Of All Time', 'Globally Outstanding Athletic Trophy', 'General Overall Achievement Title', 'Greatest Over All Tournaments'], answer: 0, subject: 'Pop Culture' },
  { q: 'Which social media platform is known for short-form videos?', options: ['TikTok', 'Instagram', 'Twitter', 'Snapchat'], answer: 0, subject: 'Pop Culture' },
  { q: 'What is the highest-grossing film franchise of all time?', options: ['Marvel Cinematic Universe', 'Star Wars', 'Harry Potter', 'James Bond'], answer: 0, subject: 'Pop Culture' },
  { q: 'What does "viral" mean in social media?', options: ['Rapidly spreading content', 'Sponsored content', 'Verified content', 'Premium content'], answer: 0, subject: 'Pop Culture' },
  { q: 'Which Nigerian music genre has gained global popularity?', options: ['Afrobeats', 'Jùjú', 'Highlife', 'Fuji'], answer: 0, subject: 'Pop Culture' },
  { q: 'What is a meme?', options: ['Viral internet joke/image', 'News article', 'Video ad', 'Podcast episode'], answer: 0, subject: 'Pop Culture' },
  { q: 'Which artist holds the record for most Grammys?', options: ['Beyoncé', 'Taylor Swift', 'Michael Jackson', 'Stevie Wonder'], answer: 0, subject: 'Pop Culture' },
  { q: 'What app popularized ephemeral "stories"?', options: ['Snapchat', 'Instagram', 'Twitter', 'Facebook'], answer: 0, subject: 'Pop Culture' },

  // ── Logic & Reasoning ──────────────────────────────────────────────────────
  { q: 'If all cats are animals and all animals breathe, do all cats breathe?', options: ['Yes', 'No', 'Sometimes', 'Cannot determine'], answer: 0, subject: 'Logic' },
  { q: 'What comes next: 2, 4, 8, 16, ___?', options: ['32', '24', '30', '20'], answer: 0, subject: 'Logic' },
  { q: 'What is the missing number: 1, 4, 9, 16, ___?', options: ['25', '20', '30', '24'], answer: 0, subject: 'Logic' },
  { q: 'A man walks 3km north, 4km east. How far is he from start?', options: ['5 km', '7 km', '4 km', '6 km'], answer: 0, subject: 'Logic' },
  { q: 'If A > B and B > C, then A vs C?', options: ['A > C', 'A < C', 'A = C', 'Cannot tell'], answer: 0, subject: 'Logic' },
  { q: 'What comes next: 1, 1, 2, 3, 5, 8, ___?', options: ['13', '11', '12', '16'], answer: 0, subject: 'Logic' },
  { q: 'How many months have 28 days?', options: ['All 12', '1', '4', '6'], answer: 0, subject: 'Logic' },
  { q: 'If you overtake the person in 2nd place, what place are you in?', options: ['2nd', '1st', '3rd', 'Cannot tell'], answer: 0, subject: 'Logic' },
  { q: 'What has hands but can\'t clap?', options: ['A clock', 'A glove', 'A tree', 'A statue'], answer: 0, subject: 'Logic' },
  { q: 'What gets wetter as it dries?', options: ['A towel', 'A sponge', 'Paper', 'Clothes'], answer: 0, subject: 'Logic' },
]

// Utility: shuffle an array (Fisher-Yates)
export function shuffleQuestions(arr: TriviaQuestion[]): TriviaQuestion[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function shuffleOptions(q: TriviaQuestion): TriviaQuestion {
  const correctAnswer = q.options[q.answer]
  const shuffled = [...q.options]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return { ...q, options: shuffled, answer: shuffled.indexOf(correctAnswer) }
}

// Pick N random questions, optionally from specific subjects
export function pickQuestions(n: number, subjects?: string[]): TriviaQuestion[] {
  const pool = subjects
    ? TRIVIA_QUESTIONS.filter(q => subjects.includes(q.subject))
    : TRIVIA_QUESTIONS
  return shuffleQuestions(pool).slice(0, n).map(shuffleOptions)
}
