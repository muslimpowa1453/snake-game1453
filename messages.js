const PacketType = {
    // Client -> Server
    INPUT: 0,
    JOIN: 1,
    BOOST_START: 2,
    BOOST_END: 3,

    // Server -> Client
    INIT: 10,
    UPDATE: 11,
    KILL_FEED: 13
};

const CONFIG = {
    worldSize: 4000,
    baseRadius: 10,
    turnSpeed: 0.08,
    baseSpeed: 4,
    boostSpeed: 8,
    segmentDistance: 7,
};
