-- 0002_reference.sql
insert into public.categories (slug, label, blurb, sort) values
 ('holidays','Holidays','Public holidays and the rituals we keep.',10), ('national','National days','Independence days, republic days, national festivities.',15),
 ('religion','Religious','Feasts, fasts, and holy days across faiths.',20), ('awareness','Awareness days','UN observances and international days.',25),
 ('fun','Fun days','Pizza Day, Talk Like a Pirate Day, and other excuses.',30), ('culture','Culture','Festivals, feast days, and the civic calendar.',35),
 ('festivals','Festivals','Carnivals, fairs, and gatherings.',40), ('sports','Sports','Finals, opening ceremonies, and the next World Cup.',45),
 ('esports','Esports','Worlds, Majors, and The International.',50), ('games','Games','Release dates and showcases.',55),
 ('film','Film','Premieres and awards nights.',60), ('tv','TV','Season premieres and finales.',65), ('anime','Anime','Season starts and film releases.',70),
 ('music','Music','Contests, tours, and anniversaries.',75), ('entertainment','Entertainment','Fandom dates and pop-culture holy days.',80),
 ('politics','Politics','Elections and the dates that steer countries.',85), ('tech','Tech','Conferences, end-of-life dates, and the clocks computers keep.',90),
 ('science','Science','Dates for the curious.',95), ('space','Space','Launches, landings, and the long way back to the Moon.',100),
 ('astronomy','Astronomy','Eclipses, showers, solstices.',105), ('nature','Nature','Earth, oceans, and the living year.',110),
 ('history','History','Anniversaries of things that already happened.',115), ('curiosities','Curiosities','Unix milestones, palindrome dates, Friday the 13ths.',120);
insert into public.sources (id, label, rank, homepage, license, attribution) values
 ('curated','Curated',9,null,null,null), ('user','User',0,null,null,null),
 ('astronomy','Computed astronomy',8,'https://github.com/cosinekitty/astronomy','MIT',null), ('curiosities','Computed curiosities',8,null,null,null),
 ('observances','Observance rules',6,null,null,null),
 ('ll2','Launch Library 2',7,'https://thespacedevs.com/llapi',null,'Data: The Space Devs'),
 ('football-data','football-data.org',6,'https://www.football-data.org/',null,'Football data provided by football-data.org'),
 ('hebcal','Hebcal',5,'https://www.hebcal.com/','CC-BY-4.0','Jewish holiday data from Hebcal.com'), ('aladhan','Aladhan',5,'https://aladhan.com/',null,null),
 ('tvmaze','TVMaze',5,'https://www.tvmaze.com/','CC-BY-SA','TV schedule data from TVmaze'),
 ('kitsu','Kitsu',4,'https://kitsu.app/',null,null),
 ('endoflife','endoflife.date',5,'https://endoflife.date/','MIT',null), ('confs','confs.tech',4,'https://confs.tech/','MIT',null),
 ('liquipedia','Liquipedia',4,'https://liquipedia.net/','CC-BY-SA-3.0','Esports data from Liquipedia'),
 ('wikipedia','Wikipedia',3,'https://en.wikipedia.org/','CC-BY-SA-4.0','Text from Wikipedia'),
 ('wikidata','Wikidata',2,'https://www.wikidata.org/','CC0',null),
 ('openholidays','OpenHolidays',2,'https://www.openholidaysapi.org/','ODbL','Holiday data from OpenHolidays API'),
 ('holidays','date-holidays',1,'https://github.com/commenthol/date-holidays','CC-BY-SA-3.0','Holiday data from date-holidays');
