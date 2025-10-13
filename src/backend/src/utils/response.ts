export const ok   = (data:any, message='ok')    => ({ ok:true,  message, data })
export const fail = (message='error', data:any=null) => ({ ok:false, message, data })
