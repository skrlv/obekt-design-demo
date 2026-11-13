export const products = [
  {id:'soft',name:'Мягкая линия',type:'Кресло',category:'seating',price:32500,image:'chair.jpg',color:'Слоновая кость',material:'Демонстрация: тканевая обивка, деревянный каркас',size:'72 × 76 × 82 см',copy:'Мягкий силуэт и светлая фактура для того самого уголка, где можно замедлиться.'},
  {id:'contour',name:'Контур',type:'Стул',category:'seating',price:18900,image:'lounge.jpg',color:'Серый / натуральный',material:'Демонстрация: текстиль, дерево',size:'58 × 57 × 81 см',copy:'Плавная линия спинки, мягкое сиденье и тёплый оттенок дерева. Для долгих разговоров за столом.'},
  {id:'circle',name:'Общий круг',type:'Обеденный стол',category:'tables',price:44900,image:'table.jpg',color:'Белый / натуральный',material:'Демонстрация: окрашенная столешница, деревянные ножки',size:'Ø 100 × 74 см',copy:'Круглая форма, которая собирает людей. Для утреннего кофе, вечерних ужинов и повседневной жизни.'},
  {id:'arc',name:'Арка',type:'Стул',category:'seating',price:14500,image:'chair-wood.jpg',color:'Графит / натуральный',material:'Демонстрация: формованный полимер, дерево',size:'48 × 53 × 82 см',copy:'Точный графичный акцент. Контраст чёрного силуэта и натуральных ножек оживляет спокойное пространство.'},
  {id:'ray',name:'Луч',type:'Напольный светильник',category:'light',price:21900,image:'shelf.jpg',color:'Матовый чёрный',material:'Демонстрация: окрашенный металл',size:'Высота 145 см, плафон Ø 20 см',copy:'Локальный свет и выразительный изгиб. Лаконичный объект для чтения и тихих вечеров.'},
  {id:'horizon',name:'Горизонт',type:'Диван',category:'seating',price:89500,image:'sofa.jpg',color:'Глубокий зелёный',material:'Демонстрация: велюр, деревянные опоры',size:'210 × 88 × 82 см',copy:'Глубокий цвет и спокойная горизонталь. Центр притяжения гостиной, где всем находится место.'},
];
export const money = value => new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(value);
export function sanitizeCart(value){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {};
  const cart={};
  for(const product of products){ const quantity=value[product.id]; if(Number.isInteger(quantity)&&quantity>0)cart[product.id]=Math.min(quantity,20); }
  return cart;
}
export function cartTotals(value){const cart=sanitizeCart(value);return products.reduce((sum,p)=>({count:sum.count+(cart[p.id]||0),total:sum.total+p.price*(cart[p.id]||0)}),{count:0,total:0});}
export function selectProducts(category='all',sort='default'){const result=products.filter(p=>category==='all'||p.category===category);if(sort==='asc')result.sort((a,b)=>a.price-b.price);if(sort==='desc')result.sort((a,b)=>b.price-a.price);return result;}
