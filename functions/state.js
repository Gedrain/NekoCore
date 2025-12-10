const State = {
    user: null,    
    profile: null, 
    chatRef: null, 
    dmTarget: null, 
    pendingCh: null, 
    isReg: false, 
    
    chatMode: 'channels', 

    unlockedChannels: new Set()
};