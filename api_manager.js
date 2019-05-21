var TourneyState = Object.freeze({"pending": 0, "underway": 1, "complete": 2});
var MatchState = Object.freeze({"pending": 0, "open": 1, "complete": 2});

var tournament_state = TourneyState.underway;
var tournament_owner = true;

class APIManager {

    constructor(tournament_location){
        this.tournament_cache = null;
        this.is_owner = false;
        this.is_authenticated = false;
        this.exists = false;
        this.user = "";
        this.key = "";
        var hosts = tournament_location.host.split(".");
        var id = tournament_location.pathname.replace(/^\/+/g, '');
        this.url_id = (hosts.length == 3) ? hosts[0] + "-" + id : id;
        this.socket = null;
    }

    async init(callback){
        await this.retrieveUser()
        await this.retrieveKey()
        let url = APIManager.getAPIURL("/init")
        url = url + "?user=" + this.user
        url = url + "&key=" + this.key
        url = url + "&id=" + this.url_id
        try{
            let data = await APIManager.request({url: url, method: "GET"})
            if(data.isAuthenticated){
                console.log("authenticated.")
                console.log("is owner: "+data.isOwner)
                this.is_authenticated = true
                this.is_owner = data.isOwner
                this.exists = data.exists
                if(this.exists){
                    this.tournament_cache = {
                        current_match: data.data.currentMatch,
                        next_match: data.data.nextMatch
                    }
                    console.log(this.tournament_cache)
                }
                this.socket = io(APIManager.getAPIURL('?id='+this.url_id))
                this.socket.on('update', (data) => {
                    this.tournament_cache = {
                        current_match: data.currentMatch,
                        next_match: data.nextMatch
                    }
                    unqueueStreamMatch(next_match)
                    unqueueStreamMatch(current_match)
                    queueStreamMatch(this.tournament_cache.current_match);
                    queueStreamMatch(this.tournament_cache.next_match);
                })
                callback()
            }
            else{
                console.log("failed to authenticate")
                let attempted = (this.user != '' && this.key != '')
                chrome.storage.sync.set({auth_error: attempted }, function() {
                    chrome.runtime.sendMessage({cmd: "options"}, function(response) {});
                });
            }
        }
        catch(error){
            console.log("failed to init.")
        }
    }

    updateCache(data){
        var update = (this.tournament_cache.next_match == null && data.next_match != null)
        update = update || (data.next_match == null && this.tournament_cache.next_match != null)
        update = update || (data.current_match == null && this.tournament_cache.current_match != null)
        update = update || (this.tournament_cache.current_match == null && data.current_match != null)
        update = update || (this.tournament_cache.current_match != data.current_match)
        update = update || (this.tournament_cache.next_match != data.next_match)

        if(update){
            this.tournament_cache = data
            let current_match = (data.current_match != null) ? String(data.current_match):null
            let next_match = (data.next_match != null) ? String(data.next_match):null
            let url = APIManager.getAPIURL("/update")
            var updateData = {
                id: this.url_id,
                current_match: current_match,
                next_match: next_match
            }

            if(data.current_match != null){
                var match = match_dictionary.getMatch(current_match).object
                updateData.round_name = getRoundName(match.round)
                var score1 = 0
                var score2 = 0
                if(match.scores_csv.length > 0){
                    score1 = parseInt(match.scores_csv.split('-')[0])
                    score2 = parseInt(match.scores_csv.split('-')[1])
                }
                updateData.participant1 = {
                    name: participants_dictionary.getParticipant(match.player1_id).info.name,
                    id: String(match.player1_id),
                    score: score1
                }
                updateData.participant2 = {
                    name: participants_dictionary.getParticipant(match.player2_id).info.name,
                    id: String(match.player2_id),
                    score: score2
                }
            }

            console.log(JSON.stringify(updateData))

            if(this.exists && this.is_owner){
                APIManager.request({
                    url: url,
                    method: "PUT",
                    contentType: "application/json",
                    data: JSON.stringify(updateData)
                })
            }
        }
    }

    getTournament(success, fail){
        let url = APIManager.getAPIURL("/tournament")
        url = url + "?id=" + this.url_id
        $.ajax({
            url: url,
            method: "GET",
            success: (data, textStatus, jqXHR) => {
                success(data, textStatus, jqXHR);
            },
            error: (jqXHR, textStatus, errorThrown) => {
                fail(jqXHR, textStatus, errorThrown);
            }
        });
    }

    getMatches(success, fail){
        let url = APIManager.getAPIURL("/matches")
        url = url + "?id=" + this.url_id
        $.ajax({
            url: url,
            method: "GET",
            success: (data, textStatus, jqXHR) => {
                success(data, textStatus, jqXHR);
            },
            error: (jqXHR, textStatus, errorThrown) => {
                fail(jqXHR, textStatus, errorThrown);
            }
        });
    }

    getParticipants(success, fail){
        let url = APIManager.getAPIURL("/participants")
        url = url + "?id=" + this.url_id
        $.ajax({
            url: url,
            method: "GET",
            success: (data, textStatus, jqXHR) => {
                success(data, textStatus, jqXHR);
            },
            error: (jqXHR, textStatus, errorThrown) => {
                fail(jqXHR, textStatus, errorThrown);
            }
        });
    }

    async retrieveUser(){
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get('user', (data) => {
                this.user = data.user
                resolve(this.user)
            })
        })
    }

    async retrieveKey(){
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get('key', (data) => {
                this.key = data.key
                resolve(this.key)
            })
        })
    }

    static getAPIURL(api_path){
        let url = "https://teacup-gg.herokuapp.com"
        //let url = "http://localhost:5000"
        return url+api_path
    }

    static async request(settings){
        return new Promise((resolve, reject) => {
            settings.success = (data) => {resolve(data)}
            settings.error = (error) => {reject(error)}
            $.ajax(settings)
        })
    }

}