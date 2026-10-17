import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const sampleOrders = [
 {id:101, product:'Wooden Chair', qty:20, arrival:0, time:6, priority:2, deadline:12, status:'Ready'},
 {id:102, product:'Dining Table', qty:10, arrival:0, time:9, priority:3, deadline:20, status:'Ready'},
 {id:103, product:'Office Desk', qty:15, arrival:2, time:4, priority:1, deadline:10, status:'Ready'},
 {id:104, product:'Storage Cabinet', qty:8, arrival:3, time:7, priority:2, deadline:18, status:'Ready'},
 {id:105, product:'Bookshelf', qty:12, arrival:4, time:3, priority:1, deadline:11, status:'Ready'}
];

function App() {
 const [orders, setOrders] = useState(sampleOrders);
 const [algo, setAlgo] = useState('fcfs');
 const [showAdd, setShowAdd] = useState(false);
 const [newOrder, setNewOrder] = useState({product:'', qty:1, arrival:0, time:1, priority:3, deadline:10});

 // Simple scheduling logic
 const getSchedule = () => {
   let sorted = [...orders];
   if (algo === 'sjf') {
     sorted.sort((a,b) => a.time - b.time);
   } else if (algo === 'priority') {
     sorted.sort((a,b) => a.priority - b.priority);
   } else {
     sorted.sort((a,b) => a.arrival - b.arrival);
   }
   
   let currentTime = 0;
   let results = [];
   sorted.forEach(order => {
     let start = Math.max(currentTime, order.arrival);
     let finish = start + order.time;
     let wait = start - order.arrival;
     results.push({...order, start, finish, wait});
     currentTime = finish;
   });
   return results;
 };

 const schedule = getSchedule();
 const totalWait = schedule.reduce((sum, o) => sum + o.wait, 0);
 const avgWait = orders.length > 0 ? (totalWait / orders.length).toFixed(1) : 0;
 const lateCount = schedule.filter(o => o.finish > o.deadline).length;

 const handleAdd = () => {
   if (newOrder.product.trim()) {
     const id = Math.max(...orders.map(o => o.id)) + 1;
     setOrders([...orders, {...newOrder, id, qty: Number(newOrder.qty), arrival: Number(newOrder.arrival), time: Number(newOrder.time), priority: Number(newOrder.priority), deadline: Number(newOrder.deadline), status: 'Ready'}]);
     setNewOrder({product:'', qty:1, arrival:0, time:1, priority:3, deadline:10});
     setShowAdd(false);
   }
 };

 return (
   <div className="container">
     <header className="header">
       <h1>Production Scheduler</h1>
       <p>CS Project - Production Order Scheduling System</p>
     </header>

     <div className="controls">
       <div className="control-group">
         <label>Scheduling Algorithm:</label>
         <select value={algo} onChange={(e) => setAlgo(e.target.value)}>
           <option value="fcfs">First Come First Serve (FCFS)</option>
           <option value="sjf">Shortest Job First (SJF)</option>
           <option value="priority">Priority Scheduling</option>
         </select>
       </div>
       <button className="btn-add" onClick={() => setShowAdd(!showAdd)}>
         {showAdd ? 'Cancel' : 'Add Order'}
       </button>
     </div>

     {showAdd && (
       <div className="add-form">
         <h3>Add New Order</h3>
         <div className="form-row">
           <input type="text" placeholder="Product Name" value={newOrder.product} onChange={(e) => setNewOrder({...newOrder, product: e.target.value})} />
           <input type="number" placeholder="Quantity" value={newOrder.qty} onChange={(e) => setNewOrder({...newOrder, qty: e.target.value})} />
           <input type="number" placeholder="Arrival Time" value={newOrder.arrival} onChange={(e) => setNewOrder({...newOrder, arrival: e.target.value})} />
         </div>
         <div className="form-row">
           <input type="number" placeholder="Exec Time" value={newOrder.time} onChange={(e) => setNewOrder({...newOrder, time: e.target.value})} />
           <select value={newOrder.priority} onChange={(e) => setNewOrder({...newOrder, priority: e.target.value})}>
             <option value="1">Priority 1 (High)</option>
             <option value="2">Priority 2</option>
             <option value="3">Priority 3</option>
             <option value="4">Priority 4</option>
           </select>
           <input type="number" placeholder="Deadline" value={newOrder.deadline} onChange={(e) => setNewOrder({...newOrder, deadline: e.target.value})} />
         </div>
         <button className="btn-submit" onClick={handleAdd}>Add to Queue</button>
       </div>
     )}

     <div className="stats">
       <div className="stat-box">
         <h4>Total Orders</h4>
         <div className="stat-value">{orders.length}</div>
       </div>
       <div className="stat-box">
         <h4>Avg Wait Time</h4>
         <div className="stat-value">{avgWait}</div>
       </div>
       <div className="stat-box">
         <h4>Late Orders</h4>
         <div className="stat-value" style={{color: lateCount > 0 ? '#e74c3c' : '#27ae60'}}>{lateCount}</div>
       </div>
     </div>

     <div className="section">
       <h2>Schedule Timeline</h2>
       <p className="subtitle">Current algorithm: <strong>{algo.toUpperCase()}</strong></p>
       <div className="timeline">
         {schedule.map(order => (
           <div key={order.id} className="timeline-item">
             <div className="order-info">
               <strong>#{order.id} - {order.product}</strong>
               <span>Priority: {order.priority}</span>
             </div>
             <div className="timeline-bar">
               <div 
                 className={order.finish > order.deadline ? 'bar late' : 'bar'} 
                 style={{
                   marginLeft: `${(order.start / Math.max(...schedule.map(o => o.finish))) * 100}%`,
                   width: `${(order.time / Math.max(...schedule.map(o => o.finish))) * 100}%`
                 }}
               >
                 {order.start} - {order.finish}
               </div>
             </div>
             <div className="order-status">
               {order.finish > order.deadline ? '⚠️ Late' : '✓ On Time'}
             </div>
           </div>
         ))}
       </div>
     </div>

     <div className="section">
       <h2>Order Queue</h2>
       <table>
         <thead>
           <tr>
             <th>ID</th>
             <th>Product</th>
             <th>Qty</th>
             <th>Priority</th>
             <th>Start</th>
             <th>Finish</th>
             <th>Wait</th>
             <th>Status</th>
           </tr>
         </thead>
         <tbody>
           {schedule.map(order => (
             <tr key={order.id}>
               <td>#{order.id}</td>
               <td>{order.product}</td>
               <td>{order.qty}</td>
               <td>{order.priority}</td>
               <td>{order.start}</td>
               <td>{order.finish}</td>
               <td>{order.wait}</td>
               <td className={order.finish > order.deadline ? 'late-status' : 'ok-status'}>
                 {order.finish > order.deadline ? 'LATE' : 'OK'}
               </td>
             </tr>
           ))}
         </tbody>
       </table>
     </div>

     <footer>
       <p>Smart Factory Production Scheduler - Operating Systems Project</p>
     </footer>
   </div>
 );
}

createRoot(document.getElementById('root')).render(<App/>);
